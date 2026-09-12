import type { Db } from 'mongodb';
import { resolveIdentityByPhone } from '@/lib/interakt/identity-match';
import {
  touchConversationMessageMeta,
  updateConversationMatch,
  upsertConversationIdentity,
} from '@/lib/interakt/conversation-store';
import { upsertInteraktMessage } from '@/lib/interakt/message-store';
import { runInboundMessageAutomations } from '@/lib/interakt/automation';
import {
  getInteraktBusinessWaNumber,
  maskPhoneForLog,
  toNormalizedIndianPhone,
  toWaE164Digits,
} from '@/lib/interakt/phone';
import {
  mapInteraktEventToStatus,
  mapProviderMessageStatus,
} from '@/lib/interakt/status-precedence';
import type {
  InteraktMessageStatus,
  InteraktProviderMessage,
  InteraktProviderWebhookBody,
  InteraktStatusTimestamps,
  InteraktWebhookEvent,
} from '@/lib/interakt/types';
import {
  getWebhookEventById,
  markWebhookEventStatus,
} from '@/lib/interakt/webhook-store';

const OUTBOUND_STATUS_EVENTS = new Set([
  'message_api_sent',
  'message_api_delivered',
  'message_api_read',
  'message_api_failed',
]);

const HANDLED_EVENTS = new Set([
  'message_received',
  ...OUTBOUND_STATUS_EVENTS,
  'message_api_clicked',
]);

function extractCustomerPhone(payload: InteraktProviderWebhookBody): string {
  const customer = payload.data?.customer;
  return toWaE164Digits(customer?.phone_number || customer?.channel_phone_number || '');
}

function extractCallbackData(message?: InteraktProviderMessage | null): string | null {
  const value = message?.meta_data?.source_data?.callback_data;
  return value ? String(value) : null;
}

function buildStatusTimestamps(
  eventType: string,
  message: InteraktProviderMessage | undefined,
  webhookTimestamp: string | null,
): InteraktStatusTimestamps {
  const stamps: InteraktStatusTimestamps = {};
  const fallback = message?.received_at_utc || webhookTimestamp || new Date().toISOString();

  if (eventType === 'message_received') {
    stamps.receivedAt = message?.received_at_utc || fallback;
  }
  if (eventType === 'message_api_sent') {
    stamps.sentAt = message?.received_at_utc || fallback;
  }
  if (eventType === 'message_api_delivered') {
    stamps.deliveredAt = message?.delivered_at_utc || fallback;
  }
  if (eventType === 'message_api_read') {
    stamps.readAt = message?.seen_at_utc || message?.delivered_at_utc || fallback;
  }
  if (eventType === 'message_api_failed') {
    stamps.failedAt = fallback;
  }

  if (message?.received_at_utc) stamps.receivedAt = stamps.receivedAt || message.received_at_utc;
  if (message?.delivered_at_utc) stamps.deliveredAt = stamps.deliveredAt || message.delivered_at_utc;
  if (message?.seen_at_utc) stamps.readAt = stamps.readAt || message.seen_at_utc;

  return stamps;
}

function resolveMessageStatus(
  eventType: string,
  message?: InteraktProviderMessage,
): InteraktMessageStatus {
  const fromEvent = mapInteraktEventToStatus(eventType);
  if (fromEvent) return fromEvent;
  const fromProvider = mapProviderMessageStatus(message?.message_status);
  return fromProvider || 'queued';
}

async function ensureConversationAndMaybeMatch(
  db: Db,
  input: {
    businessWaNumber: string;
    customerWaE164: string;
    normalizedPhone: string;
    providerCustomerId: string | null;
    runMatch: boolean;
  },
) {
  const conversation = await upsertConversationIdentity(db, {
    businessWaNumber: input.businessWaNumber,
    normalizedPhone: input.normalizedPhone,
    customerWaE164: input.customerWaE164,
    providerCustomerId: input.providerCustomerId,
  });

  if (!input.runMatch) {
    return conversation;
  }

  if (conversation.matchStatus === 'manually_linked') {
    return conversation;
  }

  const match = await resolveIdentityByPhone(db, input.normalizedPhone);
  await updateConversationMatch(db, conversation.id, match);
  return {
    ...conversation,
    matchStatus: match.matchStatus,
    primaryLink: match.primaryLink,
    candidateLinks: match.candidateLinks,
  };
}

async function processMessageReceived(
  db: Db,
  event: InteraktWebhookEvent,
): Promise<void> {
  const businessWaNumber = getInteraktBusinessWaNumber();
  if (!businessWaNumber) {
    throw new Error('INTERAKT_BUSINESS_WA_NUMBER is not configured.');
  }

  const payload = event.rawPayload;
  const message = payload.data?.message;
  const providerMessageId = message?.id || event.providerMessageId;
  if (!providerMessageId) {
    await markWebhookEventStatus(db, event.id, 'ignored', 'missing_provider_message_id');
    return;
  }

  const customerWaE164 = extractCustomerPhone(payload);
  const normalizedPhone = toNormalizedIndianPhone(customerWaE164);

  if (!normalizedPhone) {
    console.warn(
      '[interakt] inbound_invalid_phone',
      JSON.stringify({
        eventId: event.id,
        providerMessageId,
        phone: maskPhoneForLog(customerWaE164),
      }),
    );
    // Still persist under a synthetic conversation key when possible using raw digits,
    // but mark unmatched and skip CRM match. If no digits at all, ignore.
    if (!customerWaE164) {
      await markWebhookEventStatus(db, event.id, 'ignored', 'missing_customer_phone');
      return;
    }
  }

  const phoneKey = normalizedPhone || `invalid:${customerWaE164}`;
  const conversation = await ensureConversationAndMaybeMatch(db, {
    businessWaNumber,
    customerWaE164: customerWaE164 || phoneKey,
    normalizedPhone: phoneKey,
    providerCustomerId: event.providerCustomerId,
    runMatch: Boolean(normalizedPhone),
  });

  const at =
    message?.received_at_utc
    || event.webhookTimestamp
    || event.receivedAt;

  const { created, message: savedMessage } = await upsertInteraktMessage(db, {
    conversationId: conversation.id,
    providerMessageId,
    providerCustomerId: event.providerCustomerId,
    direction: 'inbound',
    messageType: message?.message_content_type || 'Text',
    bodyText: message?.message != null ? String(message.message) : null,
    status: 'received',
    statusTimestamps: buildStatusTimestamps('message_received', message, event.webhookTimestamp),
    failure: null,
    callbackData: extractCallbackData(message),
    normalizedPhone: phoneKey,
    businessWaNumber,
    rawMessage: message || {},
    rawEventType: event.eventType,
  });

  await touchConversationMessageMeta(db, conversation.id, {
    at,
    direction: 'inbound',
    incrementUnread: created,
  });

  try {
    await runInboundMessageAutomations(db, {
      conversation,
      message: savedMessage,
      messageCreated: created,
    });
  } catch (autoError) {
    console.error(
      '[interakt] automation_failed',
      JSON.stringify({
        eventId: event.id,
        conversationId: conversation.id,
        error: autoError instanceof Error ? autoError.message : 'automation_failed',
      }),
    );
  }

  console.info(
    '[interakt] inbound_processed',
    JSON.stringify({
      eventId: event.id,
      conversationId: conversation.id,
      providerMessageId,
      matchStatus: conversation.matchStatus,
      phone: maskPhoneForLog(customerWaE164),
      created,
    }),
  );

  await markWebhookEventStatus(db, event.id, 'processed');
}

async function processOutboundStatus(
  db: Db,
  event: InteraktWebhookEvent,
): Promise<void> {
  const businessWaNumber = getInteraktBusinessWaNumber();
  if (!businessWaNumber) {
    throw new Error('INTERAKT_BUSINESS_WA_NUMBER is not configured.');
  }

  const payload = event.rawPayload;
  const message = payload.data?.message;
  const providerMessageId = message?.id || event.providerMessageId;
  if (!providerMessageId) {
    await markWebhookEventStatus(db, event.id, 'ignored', 'missing_provider_message_id');
    return;
  }

  const customerWaE164 = extractCustomerPhone(payload);
  const normalizedPhone = toNormalizedIndianPhone(customerWaE164);
  const phoneKey = normalizedPhone || (customerWaE164 ? `invalid:${customerWaE164}` : '');

  if (!phoneKey) {
    await markWebhookEventStatus(db, event.id, 'ignored', 'missing_customer_phone');
    return;
  }

  const conversation = await ensureConversationAndMaybeMatch(db, {
    businessWaNumber,
    customerWaE164: customerWaE164 || phoneKey,
    normalizedPhone: phoneKey,
    providerCustomerId: event.providerCustomerId,
    runMatch: Boolean(normalizedPhone),
  });

  const status = resolveMessageStatus(event.eventType, message);
  const failure =
    status === 'failed'
      ? {
          reason: message?.channel_failure_reason || undefined,
          channelErrorCode: message?.channel_error_code || undefined,
        }
      : null;

  const { created } = await upsertInteraktMessage(db, {
    conversationId: conversation.id,
    providerMessageId,
    providerCustomerId: event.providerCustomerId,
    direction: 'outbound',
    messageType: message?.message_content_type || 'Template',
    bodyText: message?.message != null ? String(message.message) : null,
    status,
    statusTimestamps: buildStatusTimestamps(event.eventType, message, event.webhookTimestamp),
    failure,
    callbackData: extractCallbackData(message),
    normalizedPhone: phoneKey,
    businessWaNumber,
    rawMessage: message || {},
    rawEventType: event.eventType,
  });

  const at =
    message?.delivered_at_utc
    || message?.seen_at_utc
    || message?.received_at_utc
    || event.webhookTimestamp
    || event.receivedAt;

  await touchConversationMessageMeta(db, conversation.id, {
    at,
    direction: 'outbound',
    incrementUnread: false,
  });

  console.info(
    '[interakt] status_processed',
    JSON.stringify({
      eventId: event.id,
      eventType: event.eventType,
      conversationId: conversation.id,
      providerMessageId,
      status,
      created,
      phone: maskPhoneForLog(customerWaE164),
    }),
  );

  await markWebhookEventStatus(db, event.id, 'processed');
}

async function processClicked(
  db: Db,
  event: InteraktWebhookEvent,
): Promise<void> {
  // Clicks are metadata. Persist/refresh the outbound message without inventing a new status rank.
  // Reuse outbound pipeline but keep provider message_status when present; default to sent.
  const message = event.rawPayload.data?.message;
  const mapped = mapProviderMessageStatus(message?.message_status) || 'sent';
  const syntheticType =
    mapped === 'delivered'
      ? 'message_api_delivered'
      : mapped === 'read'
        ? 'message_api_read'
        : mapped === 'failed'
          ? 'message_api_failed'
          : 'message_api_sent';
  await processOutboundStatus(db, { ...event, eventType: syntheticType });
}

/**
 * Async processor invoked after webhook acknowledgement.
 */
export async function processInteraktWebhookEvent(
  db: Db,
  eventId: string,
): Promise<void> {
  const event = await getWebhookEventById(db, eventId);
  if (!event) {
    console.warn('[interakt] process_missing_event', JSON.stringify({ eventId }));
    return;
  }

  if (event.processingStatus === 'processed' || event.processingStatus === 'ignored') {
    return;
  }

  try {
    if (!HANDLED_EVENTS.has(event.eventType)) {
      console.info(
        '[interakt] event_ignored',
        JSON.stringify({ eventId: event.id, eventType: event.eventType }),
      );
      await markWebhookEventStatus(db, event.id, 'ignored', 'unsupported_event_type');
      return;
    }

    if (event.eventType === 'message_received') {
      await processMessageReceived(db, event);
      return;
    }

    if (event.eventType === 'message_api_clicked') {
      await processClicked(db, event);
      return;
    }

    if (OUTBOUND_STATUS_EVENTS.has(event.eventType)) {
      await processOutboundStatus(db, event);
      return;
    }

    await markWebhookEventStatus(db, event.id, 'ignored', 'unsupported_event_type');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'process_failed';
    console.error(
      '[interakt] process_failed',
      JSON.stringify({ eventId: event.id, eventType: event.eventType, error: message }),
    );
    await markWebhookEventStatus(db, event.id, 'failed', message);
  }
}
