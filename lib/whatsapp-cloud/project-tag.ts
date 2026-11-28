import type { Db } from 'mongodb';
import {
  WA_CONVERSATIONS_COLLECTION,
  ensureWaConversationIndexes,
  getConversationById,
} from '@/lib/whatsapp-cloud/conversation-store';
import {
  projectForTemplate,
  templateNameFromOutbound,
  templateProjectMap,
  templateStoredAt,
  type OutboundTemplateSource,
} from '@/lib/whatsapp-cloud/project-map';
import type { WaMessage } from '@/lib/whatsapp-cloud/types';

const WA_MESSAGES = 'wa_messages';
const BACKFILL_BATCH = 200;

const inflight = new WeakMap<object, Promise<number>>();
const appliedMapSignatures = new WeakMap<object, string>();

type TagInput = {
  templateName: string;
  sentAt: string;
  repliedAfterTemplate?: boolean;
};

function mapSignature(): string {
  const entries = Object.entries(templateProjectMap()).sort(([a], [b]) => a.localeCompare(b));
  return JSON.stringify(entries);
}

/**
 * Record the last outbound template on the conversation and the project it maps to.
 * An older template never overwrites a newer one. Only these optional fields are set.
 */
export async function applyConversationProjectTag(
  db: Db,
  conversationId: string,
  input: TagInput,
): Promise<void> {
  if (!conversationId || !input.templateName || !input.sentAt) return;
  const existing = await getConversationById(db, conversationId);
  if (!existing) return;
  if (existing.projectTemplateAt && input.sentAt < existing.projectTemplateAt) return;

  const project = projectForTemplate(input.templateName);
  const replied = input.repliedAfterTemplate
    ?? Boolean(existing.lastInboundAt && existing.lastInboundAt > input.sentAt);

  await db.collection(WA_CONVERSATIONS_COLLECTION).updateOne(
    { id: conversationId },
    {
      $set: {
        project,
        projectTemplate: input.templateName,
        projectTemplateAt: input.sentAt,
        projectInferredAt: new Date().toISOString(),
        repliedAfterTemplate: replied,
      },
    },
  );
}

export async function tagConversationFromOutboundMessage(
  db: Db,
  message: OutboundTemplateSource & { conversationId?: string | null },
): Promise<void> {
  const templateName = templateNameFromOutbound(message);
  const sentAt = templateStoredAt(message);
  if (!templateName || !sentAt || !message.conversationId) return;
  await applyConversationProjectTag(db, message.conversationId, { templateName, sentAt });
}

/** An inbound message after the tagged template marks the thread as replied. */
export async function noteInboundAfterTemplate(
  db: Db,
  conversationId: string,
  inboundAt: string,
): Promise<void> {
  if (!conversationId || !inboundAt) return;
  const existing = await getConversationById(db, conversationId);
  if (!existing?.projectTemplateAt) return;
  if (inboundAt <= existing.projectTemplateAt) return;
  if (existing.repliedAfterTemplate) return;
  await db.collection(WA_CONVERSATIONS_COLLECTION).updateOne(
    { id: conversationId },
    { $set: { repliedAfterTemplate: true } },
  );
}

type StoredMessage = WaMessage & { templateName?: string | null };

function latestTemplate(messages: StoredMessage[]): { name: string; sentAt: string } | null {
  let latest: { name: string; sentAt: string } | null = null;
  for (const message of messages) {
    const name = templateNameFromOutbound(message);
    const sentAt = templateStoredAt(message);
    if (!name || !sentAt) continue;
    if (!latest || sentAt > latest.sentAt) latest = { name, sentAt };
  }
  return latest;
}

function repliedAfter(messages: StoredMessage[], sentAt: string): boolean {
  return messages.some((message) => (
    message.direction === 'inbound' && Boolean(message.createdAt) && message.createdAt > sentAt
  ));
}

async function backfillMissing(db: Db): Promise<number> {
  await ensureWaConversationIndexes(db);
  let updated = 0;
  for (let batch = 0; batch < 25; batch += 1) {
    const pending = await db.collection(WA_CONVERSATIONS_COLLECTION)
      .find({ projectInferredAt: { $exists: false } }, { projection: { _id: 0, id: 1 } })
      .limit(BACKFILL_BATCH)
      .toArray();
    if (!pending.length) break;
    const ids = pending
      .map((row) => String((row as { id?: string }).id || ''))
      .filter(Boolean);
    const messages = ids.length
      ? await db.collection(WA_MESSAGES).find({ conversationId: { $in: ids } }).toArray() as unknown as StoredMessage[]
      : [];
    const byConversation = new Map<string, StoredMessage[]>();
    for (const message of messages) {
      const id = message.conversationId;
      if (!id) continue;
      const list = byConversation.get(id) || [];
      list.push(message);
      byConversation.set(id, list);
    }
    const now = new Date().toISOString();
    for (const id of ids) {
      const rows = byConversation.get(id) || [];
      const latest = latestTemplate(rows);
      if (!latest) {
        await db.collection(WA_CONVERSATIONS_COLLECTION).updateOne(
          { id },
          { $set: { projectInferredAt: now } },
        );
        updated += 1;
        continue;
      }
      await applyConversationProjectTag(db, id, {
        templateName: latest.name,
        sentAt: latest.sentAt,
        repliedAfterTemplate: repliedAfter(rows, latest.sentAt),
      });
      updated += 1;
    }
    if (pending.length < BACKFILL_BATCH) break;
  }
  return updated;
}

/** Re-read stored template names when the map changes, so new projects apply without a rescan. */
async function remapStoredTemplates(db: Db): Promise<number> {
  const rows = await db.collection(WA_CONVERSATIONS_COLLECTION)
    .find({}, { projection: { _id: 0, id: 1, project: 1, projectTemplate: 1 } })
    .toArray() as unknown as Array<{ id?: string; project?: string | null; projectTemplate?: string | null }>;
  let updated = 0;
  for (const row of rows) {
    const templateName = row.projectTemplate?.trim();
    if (!row.id || !templateName) continue;
    const project = projectForTemplate(templateName);
    if ((row.project || null) === project) continue;
    await db.collection(WA_CONVERSATIONS_COLLECTION).updateOne(
      { id: row.id },
      { $set: { project } },
    );
    updated += 1;
  }
  return updated;
}

/**
 * Fill project on conversations that have not been inferred yet, then refresh
 * stored projects when the template map changes. Never deletes conversations,
 * messages, or unrelated fields.
 */
export function syncConversationProjects(db: Db): Promise<number> {
  const current = inflight.get(db);
  if (current) return current;
  const run = (async () => {
    const updated = await backfillMissing(db);
    const signature = mapSignature();
    if (appliedMapSignatures.get(db) !== signature) {
      await remapStoredTemplates(db);
      appliedMapSignatures.set(db, signature);
    }
    return updated;
  })().finally(() => {
    inflight.delete(db);
  });
  inflight.set(db, run);
  return run;
}
