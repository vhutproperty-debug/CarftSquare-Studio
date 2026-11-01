import type { Db } from 'mongodb';
import { resolveIdentityByPhone } from '@/lib/whatsapp-cloud/identity-match';
import {
  touchConversationMessageMeta,
  updateConversationMatch,
  upsertConversationIdentity,
} from '@/lib/whatsapp-cloud/conversation-store';
import { upsertWaMessage } from '@/lib/whatsapp-cloud/message-store';
import { runInboundMessageAutomations } from '@/lib/whatsapp-cloud/automation';
import { extractInboundMessageContent } from '@/lib/whatsapp-cloud/inbound-content';
import {
  getWaBusinessWaNumber,
  maskPhoneForLog,
  sha256Hex,
} from '@/lib/whatsapp-cloud/phone';
import { phoneKeyFromWaId } from '@/lib/ops/outreach-phone';
import { applyProspectWhatsAppReply } from '@/lib/ops/calls/prospect-replies';
import { sendText } from '@/lib/whatsapp-cloud/client';
import { classifyWhatsAppError } from '@/lib/whatsapp-cloud/errors';
import { isStopKeyword, recordOptOut, touchInbound } from '@/lib/whatsapp-cloud/consent';
import { applyTemplateStatusUpdate } from '@/lib/whatsapp-cloud/templates';
import { pauseWhatsAppSending } from '@/lib/whatsapp-cloud/send-policy';
import type { WaProviderMessage, WaWebhookEvent } from '@/lib/whatsapp-cloud/types';
import {
  getWebhookEventById,
  insertCloudWebhookEvent,
  markWebhookEventStatus,
} from '@/lib/whatsapp-cloud/webhook-store';

const STATUS_RANK_EVENT: Record<string, string> = {
  sent: 'message_api_sent',
  delivered: 'message_api_delivered',
  read: 'message_api_read',
  failed: 'message_api_failed',
};

function businessNumber(): string {
  return getWaBusinessWaNumber() || 'whatsapp_cloud';
}

export type CloudWebhookJob = {
  eventType: string;
  providerEventKey: string;
  providerMessageId: string | null;
  waId: string | null;
  webhookTimestamp: string | null;
  rawPayload: unknown;
};

export function extractCloudWebhookJobs(body: unknown): CloudWebhookJob[] {
  const jobs: CloudWebhookJob[] = [];
  const root = body as {
    entry?: Array<{
      id?: string;
      changes?: Array<{ field?: string; value?: Record<string, unknown> }>;
    }>;
  };
  for (const entry of root.entry || []) {
    for (const change of entry.changes || []) {
      const field = String(change.field || 'unknown');
      const value = change.value || {};
      if (field === 'messages') {
        const messages = Array.isArray(value.messages) ? value.messages : [];
        const statuses = Array.isArray(value.statuses) ? value.statuses : [];
        for (const message of messages) {
          const id = String((message as { id?: string }).id || '');
          if (!id) continue;
          jobs.push({
            eventType: 'messages',
            providerEventKey: `messages:${id}`,
            providerMessageId: id,
            waId: String((message as { from?: string }).from || '') || null,
            webhookTimestamp: String((message as { timestamp?: string }).timestamp || '') || null,
            rawPayload: { value, message },
          });
        }
        for (const status of statuses) {
          const id = String((status as { id?: string }).id || '');
          const state = String((status as { status?: string }).status || '');
          if (!id) continue;
          jobs.push({
            eventType: 'statuses',
            providerEventKey: `statuses:${id}:${state}`,
            providerMessageId: id,
            waId: String((status as { recipient_id?: string }).recipient_id || '') || null,
            webhookTimestamp: String((status as { timestamp?: string }).timestamp || '') || null,
            rawPayload: { value, status },
          });
        }
      } else if (field === 'message_template_status_update') {
        const name = String(value.message_template_name || value.name || 'template');
        const language = String(value.message_template_language || '');
        const event = String(value.event || value.message_template_status || '');
        jobs.push({
          eventType: 'message_template_status_update',
          providerEventKey: `template:${name}:${language}:${event}:${String(value.message_template_id || '')}`,
          providerMessageId: null,
          waId: null,
          webhookTimestamp: null,
          rawPayload: { value },
        });
      } else if (
        field === 'account_update'
        || field === 'phone_number_quality_update'
        || field === 'message_template_quality_update'
      ) {
        const hash = sha256Hex(JSON.stringify(value));
        jobs.push({
          eventType: field,
          providerEventKey: `${field}:${hash}`,
          providerMessageId: null,
          waId: null,
          webhookTimestamp: null,
          rawPayload: { value, entryId: entry.id || null },
        });
      }
    }
  }
  return jobs;
}

export async function acceptCloudWebhook(db: Db, rawBody: string, body: unknown) {
  const jobs = extractCloudWebhookJobs(body);
  if (!jobs.length) {
    const hash = sha256Hex(rawBody);
    const inserted = await insertCloudWebhookEvent(db, {
      rawBody,
      eventType: 'ping',
      providerEventKey: `ping:${hash}`,
      providerMessageId: null,
      waId: null,
      webhookTimestamp: null,
      rawPayload: body,
    });
    return { accepted: inserted.duplicate ? 0 : 1, eventIds: [inserted.event.id], duplicate: inserted.duplicate };
  }

  const eventIds: string[] = [];
  let accepted = 0;
  for (const job of jobs) {
    const inserted = await insertCloudWebhookEvent(db, {
      rawBody,
      eventType: job.eventType,
      providerEventKey: job.providerEventKey,
      providerMessageId: job.providerMessageId,
      waId: job.waId,
      webhookTimestamp: job.webhookTimestamp,
      rawPayload: job.rawPayload,
    });
    eventIds.push(inserted.event.id);
    if (!inserted.duplicate) accepted += 1;
    else if (inserted.event.processingStatus === 'accepted' || inserted.event.processingStatus === 'failed') {
      accepted += 1;
    }
  }
  return { accepted, eventIds, duplicate: accepted === 0 };
}

function cloudMessageToProvider(message: Record<string, unknown>): WaProviderMessage {
  const content = extractInboundMessageContent(message);
  const type = content.type;
  const media = type === 'button' || type === 'interactive' || type === 'text'
    ? undefined
    : message[type] as { id?: string; caption?: string; mime_type?: string; filename?: string; link?: string } | undefined;
  return {
    id: String(message.id || ''),
    message_content_type: type,
    message: content.text || media?.caption || null,
    media_id: media?.id || null,
    media_url: media?.link || null,
    mime: media?.mime_type || null,
    filename: media?.filename || null,
    received_at_utc: message.timestamp
      ? new Date(Number(message.timestamp) * 1000).toISOString()
      : new Date().toISOString(),
  };
}

async function ensureConversation(
  db: Db,
  input: { waId: string; normalizedPhone: string; runMatch: boolean },
) {
  const conversation = await upsertConversationIdentity(db, {
    businessWaNumber: businessNumber(),
    normalizedPhone: input.normalizedPhone,
    customerWaE164: input.waId,
    providerCustomerId: input.waId,
  });
  if (!input.runMatch || conversation.matchStatus === 'manually_linked') return conversation;
  const match = await resolveIdentityByPhone(db, input.normalizedPhone);
  await updateConversationMatch(db, conversation.id, match);
  return { ...conversation, ...match };
}

async function processInbound(db: Db, event: WaWebhookEvent) {
  const payload = event.rawPayload as { message?: Record<string, unknown> };
  const message = payload.message;
  if (!message) {
    await markWebhookEventStatus(db, event.id, 'ignored', 'missing_message');
    return;
  }
  const provider = cloudMessageToProvider(message);
  const providerMessageId = provider.id || event.providerMessageId;
  if (!providerMessageId) {
    await markWebhookEventStatus(db, event.id, 'ignored', 'missing_provider_message_id');
    return;
  }
  const waId = String(message.from || event.providerCustomerId || '').replace(/\D/g, '');
  const phoneKey = phoneKeyFromWaId(waId);
  if (!phoneKey) {
    await markWebhookEventStatus(db, event.id, 'ignored', 'missing_customer_phone');
    return;
  }

  const at = provider.received_at_utc || event.receivedAt;
  if (!phoneKey.startsWith('invalid:')) await touchInbound(db, `+${waId}`, at);

  const conversation = await ensureConversation(db, {
    waId: waId || phoneKey,
    normalizedPhone: phoneKey,
    runMatch: !phoneKey.startsWith('invalid:'),
  });

  const { created, message: saved } = await upsertWaMessage(db, {
    conversationId: conversation.id,
    providerMessageId,
    providerCustomerId: waId || null,
    direction: 'inbound',
    messageType: provider.message_content_type || 'text',
    bodyText: provider.message != null ? String(provider.message) : null,
    status: 'received',
    statusTimestamps: { receivedAt: at },
    failure: null,
    callbackData: null,
    normalizedPhone: phoneKey,
    businessWaNumber: businessNumber(),
    rawMessage: provider,
    rawEventType: 'messages',
  });

  await touchConversationMessageMeta(db, conversation.id, {
    at,
    direction: 'inbound',
    incrementUnread: created,
  });

  if (isStopKeyword(provider.message)) {
    await recordOptOut(db, `+${waId}`);
    await applyProspectWhatsAppReply(db, waId, provider.message);
    await db.collection('wa_conversations').updateOne(
      { id: conversation.id },
      {
        $set: {
          doNotContact: true,
          doNotContactAt: new Date().toISOString(),
          doNotContactReason: 'stop_keyword',
          updatedAt: new Date().toISOString(),
        },
      },
    );
    try {
      await sendText(
        `+${waId}`,
        'You will not receive further WhatsApp messages from CraftSquare. Reply START if this was a mistake.',
        { ignoreOptOut: true },
      );
    } catch (error) {
      console.warn('[whatsapp] opt_out_ack_failed', error instanceof Error ? error.message : error);
    }
  } else if (provider.message) {
    await applyProspectWhatsAppReply(db, waId, provider.message);
  }

  try {
    await runInboundMessageAutomations(db, {
      conversation,
      message: saved,
      messageCreated: created,
    });
  } catch (error) {
    console.error('[whatsapp] automation_failed', error instanceof Error ? error.message : error);
  }

  console.info('[whatsapp] inbound_processed', JSON.stringify({
    eventId: event.id,
    providerMessageId,
    phone: maskPhoneForLog(waId),
    created,
  }));
  await markWebhookEventStatus(db, event.id, 'processed');
}

async function processStatus(db: Db, event: WaWebhookEvent) {
  const payload = event.rawPayload as {
    status?: {
      id?: string;
      status?: string;
      timestamp?: string;
      recipient_id?: string;
      errors?: Array<{ code?: number; title?: string; message?: string }>;
    };
  };
  const status = payload.status;
  const providerMessageId = status?.id || event.providerMessageId;
  if (!providerMessageId || !status?.status) {
    await markWebhookEventStatus(db, event.id, 'ignored', 'missing_status');
    return;
  }
  const state = String(status.status).toLowerCase();
  const mapped = state === 'read' || state === 'delivered' || state === 'sent' || state === 'failed'
    ? state
    : 'queued';
  const error = status.errors?.[0];
  const classified = error ? classifyWhatsAppError(error.code) : null;
  const waId = String(status.recipient_id || '').replace(/\D/g, '');
  const phoneKey = phoneKeyFromWaId(waId) || 'unknown';
  const at = status.timestamp
    ? new Date(Number(status.timestamp) * 1000).toISOString()
    : event.receivedAt;

  let conversationId: string | null = null;
  if (phoneKey !== 'unknown') {
    const conversation = await ensureConversation(db, {
      waId: waId || phoneKey,
      normalizedPhone: phoneKey,
      runMatch: false,
    });
    conversationId = conversation.id;
  }

  if (!conversationId) {
    const existing = await db.collection('wa_messages').findOne({ providerMessageId });
    conversationId = existing ? String((existing as { conversationId?: string }).conversationId || '') : '';
  }
  if (!conversationId) {
    await markWebhookEventStatus(db, event.id, 'ignored', 'status_without_conversation');
    return;
  }

  const stamps: Record<string, string> = {};
  if (mapped === 'sent') stamps.sentAt = at;
  if (mapped === 'delivered') stamps.deliveredAt = at;
  if (mapped === 'read') stamps.readAt = at;
  if (mapped === 'failed') stamps.failedAt = at;

  await upsertWaMessage(db, {
    conversationId,
    providerMessageId,
    providerCustomerId: waId || null,
    direction: 'outbound',
    messageType: 'status',
    bodyText: null,
    status: mapped as 'sent' | 'delivered' | 'read' | 'failed' | 'queued',
    statusTimestamps: stamps,
    failure: mapped === 'failed'
      ? { reason: error?.title || error?.message, channelErrorCode: error?.code ? String(error.code) : undefined }
      : null,
    callbackData: null,
    normalizedPhone: phoneKey,
    businessWaNumber: businessNumber(),
    rawMessage: {
      id: providerMessageId,
      message_status: state,
      channel_error_code: error?.code ? String(error.code) : null,
      channel_failure_reason: error?.title || error?.message || null,
    },
    rawEventType: STATUS_RANK_EVENT[mapped] || 'message_api_sent',
  });

  if (classified?.pauseSends) {
    await pauseWhatsAppSending(db, `WhatsApp account restricted (${classified.code})`);
    console.error('[whatsapp] sending_paused', JSON.stringify({ code: classified.code }));
  }

  try {
    const { applyOutboundStatusToDeliveryEngine } = await import('@/lib/whatsapp-cloud/delivery/webhook-bridge');
    await applyOutboundStatusToDeliveryEngine(db, {
      providerMessageId,
      providerEventId: event.id,
      waStatus: mapped,
      channelErrorCode: error?.code ? String(error.code) : null,
      channelFailureReason: error?.title || error?.message || null,
    });
  } catch (deliveryError) {
    console.error('[whatsapp] delivery_bridge_failed', deliveryError instanceof Error ? deliveryError.message : deliveryError);
  }

  await markWebhookEventStatus(db, event.id, 'processed');
}

async function processTemplateStatus(db: Db, event: WaWebhookEvent) {
  const value = (event.rawPayload as { value?: Record<string, unknown> }).value || {};
  const name = String(value.message_template_name || '');
  if (!name) {
    await markWebhookEventStatus(db, event.id, 'ignored', 'missing_template_name');
    return;
  }
  await applyTemplateStatusUpdate(db, {
    name,
    language: value.message_template_language ? String(value.message_template_language) : undefined,
    status: String(value.event || value.message_template_status || 'UNKNOWN'),
    reason: value.reason ? String(value.reason) : undefined,
  });
  await markWebhookEventStatus(db, event.id, 'processed');
}

async function processAccountAlert(db: Db, event: WaWebhookEvent) {
  const value = (event.rawPayload as { value?: Record<string, unknown> }).value || {};
  console.warn('[whatsapp] account_alert', JSON.stringify({ eventType: event.eventType, value }));
  await db.collection('ops_activity_logs').insertOne({
    id: event.id,
    action: 'whatsapp_account_alert',
    actorId: 'system:whatsapp',
    actorEmail: 'whatsapp@system.local',
    resource: 'wa_webhook_events',
    resourceId: event.id,
    details: { eventType: event.eventType, value },
    createdAt: new Date().toISOString(),
  });
  const eventName = String(value.event || value.decision || '').toUpperCase();
  if (event.eventType === 'account_update' && /RESTRICT|DISABLE|BAN/.test(eventName)) {
    await pauseWhatsAppSending(db, `account_update:${eventName || 'restricted'}`);
  }
  await markWebhookEventStatus(db, event.id, 'processed');
}

export async function processCloudWebhookEvent(db: Db, eventId: string): Promise<void> {
  const event = await getWebhookEventById(db, eventId);
  if (!event) return;
  if (event.processingStatus === 'processed' || event.processingStatus === 'ignored') return;
  try {
    if (event.eventType === 'messages') await processInbound(db, event);
    else if (event.eventType === 'statuses') await processStatus(db, event);
    else if (event.eventType === 'message_template_status_update') await processTemplateStatus(db, event);
    else if (event.eventType === 'ping') await markWebhookEventStatus(db, event.id, 'processed');
    else if (
      event.eventType === 'account_update'
      || event.eventType === 'phone_number_quality_update'
      || event.eventType === 'message_template_quality_update'
    ) await processAccountAlert(db, event);
    else await markWebhookEventStatus(db, event.id, 'ignored', 'unsupported_event_type');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'process_failed';
    console.error('[whatsapp] process_failed', JSON.stringify({ eventId, error: message }));
    await markWebhookEventStatus(db, event.id, 'failed', message);
  }
}
