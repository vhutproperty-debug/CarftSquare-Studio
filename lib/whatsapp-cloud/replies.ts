import type { Db } from 'mongodb';
import { normalizeContactPhone } from '@/lib/ops/contacts/phone';
import { isStopKeyword } from '@/lib/whatsapp-cloud/consent';
import {
  WA_CONVERSATIONS_COLLECTION,
  ensureWaConversationIndexes,
} from '@/lib/whatsapp-cloud/conversation-store';
import { phoneStorageVariants } from '@/lib/whatsapp-cloud/phone';
import { configuredProjectNames } from '@/lib/whatsapp-cloud/project-map';
import { syncConversationProjects } from '@/lib/whatsapp-cloud/project-tag';
import type { WaConversation, WaMessage } from '@/lib/whatsapp-cloud/types';

const WA_MESSAGES = 'wa_messages';
const SCAN_LIMIT = 1000;

export type WhatsAppReply = {
  contactName: string | null;
  phone: string;
  project: string;
  template: string;
  replyText: string | null;
  replyAt: string;
  optOut: boolean;
};

export type ReplyListFilters = {
  project?: string;
  since?: string | null;
  limit?: number;
};

export function parseRepliesSince(raw: string | null): { since: string | null } | { error: string } {
  const value = raw?.trim() || '';
  if (!value) return { since: null };
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00.000Z` : value;
  const time = Date.parse(iso);
  if (Number.isNaN(time)) return { error: 'since must be an ISO date or timestamp.' };
  return { since: new Date(time).toISOString() };
}

export function replyPhone(conversation: Pick<WaConversation, 'customerWaE164' | 'normalizedPhone'>): string {
  const e164 = conversation.customerWaE164?.trim();
  if (e164) {
    return e164.startsWith('+') ? e164 : `+${e164.replace(/\D/g, '')}`;
  }
  const digits = conversation.normalizedPhone.replace(/\D/g, '');
  if (digits.length === 10) return `+91${digits}`;
  if (digits) return `+${digits}`;
  return conversation.normalizedPhone;
}

function phoneKey(conversation: WaConversation): string | null {
  return normalizeContactPhone(conversation.customerWaE164 || conversation.normalizedPhone);
}

async function namesByPhone(db: Db, conversations: WaConversation[]): Promise<Map<string, string>> {
  const variants = new Set<string>();
  for (const conversation of conversations) {
    for (const value of phoneStorageVariants(conversation.normalizedPhone)) variants.add(value);
    if (conversation.customerWaE164) {
      for (const value of phoneStorageVariants(conversation.customerWaE164)) variants.add(value);
    }
  }
  const list = [...variants];
  const names = new Map<string, string>();
  if (!list.length) return names;

  const contacts = await db.collection('contacts').find({ phones: { $in: list } }).toArray() as Array<{
    name?: string;
    phones?: string[];
  }>;
  for (const contact of contacts) {
    const name = contact.name?.trim();
    if (!name) continue;
    for (const phone of contact.phones || []) {
      const key = normalizeContactPhone(phone);
      if (key) names.set(key, name);
    }
  }

  const prospects = await db.collection('ops_prospects').find({
    $or: [{ phone: { $in: list } }, { alternatePhone: { $in: list } }],
  }).toArray() as Array<{ name?: string; phone?: string; alternatePhone?: string }>;
  for (const prospect of prospects) {
    const name = prospect.name?.trim();
    if (!name) continue;
    for (const phone of [prospect.phone, prospect.alternatePhone]) {
      const key = normalizeContactPhone(phone);
      if (key && !names.has(key)) names.set(key, name);
    }
  }
  return names;
}

function contactName(conversation: WaConversation, names: Map<string, string>): string | null {
  const label = conversation.primaryLink?.label?.trim();
  if (label) return label;
  const key = phoneKey(conversation);
  return (key && names.get(key)) || null;
}

function firstReplyAfter(messages: WaMessage[], sentAt: string): WaMessage | null {
  const inbound = messages
    .filter((message) => message.direction === 'inbound' && message.createdAt > sentAt)
    .sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : a.id.localeCompare(b.id)));
  return inbound[0] || null;
}

/**
 * First inbound reply after the last outbound template, for conversations
 * whose template maps to a project.
 */
export async function listWhatsAppReplies(db: Db, filters: ReplyListFilters = {}): Promise<WhatsAppReply[]> {
  await syncConversationProjects(db);
  await ensureWaConversationIndexes(db);
  const limit = Math.min(Math.max(Number(filters.limit) || 200, 1), 500);
  const query: Record<string, unknown> = {
    hidden: { $ne: true },
    repliedAfterTemplate: true,
  };
  if (filters.project) query.project = filters.project;

  const conversations = await db.collection(WA_CONVERSATIONS_COLLECTION)
    .find(query, { projection: { _id: 0 } })
    .sort({ lastInboundAt: -1, updatedAt: -1 })
    .limit(SCAN_LIMIT)
    .toArray() as unknown as WaConversation[];

  const tagged = conversations.filter((conversation) => (
    Boolean(conversation.project?.trim())
    && Boolean(conversation.projectTemplate?.trim())
    && Boolean(conversation.projectTemplateAt)
  ));
  if (!tagged.length) return [];

  const ids = tagged.map((conversation) => conversation.id);
  const messages = await db.collection(WA_MESSAGES)
    .find({ conversationId: { $in: ids }, direction: 'inbound' })
    .toArray() as unknown as WaMessage[];
  const byConversation = new Map<string, WaMessage[]>();
  for (const message of messages) {
    const list = byConversation.get(message.conversationId) || [];
    list.push(message);
    byConversation.set(message.conversationId, list);
  }

  const names = await namesByPhone(db, tagged);
  const since = filters.since || null;
  const replies: WhatsAppReply[] = [];
  for (const conversation of tagged) {
    const reply = firstReplyAfter(byConversation.get(conversation.id) || [], conversation.projectTemplateAt || '');
    if (!reply) continue;
    if (since && reply.createdAt < since) continue;
    const text = reply.bodyText?.trim() || null;
    replies.push({
      contactName: contactName(conversation, names),
      phone: replyPhone(conversation),
      project: conversation.project || '',
      template: conversation.projectTemplate || '',
      replyText: text,
      replyAt: reply.createdAt,
      optOut: isStopKeyword(text),
    });
  }

  replies.sort((a, b) => (a.replyAt < b.replyAt ? 1 : a.replyAt > b.replyAt ? -1 : 0));
  return replies.slice(0, limit);
}

export async function listInboxProjects(db: Db): Promise<string[]> {
  await ensureWaConversationIndexes(db);
  const stored = await db.collection(WA_CONVERSATIONS_COLLECTION).distinct('project');
  const names = new Set<string>(configuredProjectNames());
  for (const value of stored) {
    if (typeof value === 'string' && value.trim()) names.add(value.trim());
  }
  return [...names].sort((a, b) => a.localeCompare(b));
}
