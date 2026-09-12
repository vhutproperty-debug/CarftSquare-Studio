import { v4 as uuidv4 } from 'uuid';
import type { Db } from 'mongodb';
import { getDb } from '@/lib/mongodb';
import type {
  InteraktProviderWebhookBody,
  InteraktWebhookEvent,
  InteraktWebhookProcessingStatus,
} from '@/lib/interakt/types';
import { buildProviderEventKey, sha256Hex } from '@/lib/interakt/phone';

export const INTERAKT_WEBHOOK_EVENTS_COLLECTION = 'interakt_webhook_events';

let indexesEnsured = false;

export async function ensureInteraktWebhookIndexes(db: Db): Promise<void> {
  if (indexesEnsured) return;
  const col = db.collection(INTERAKT_WEBHOOK_EVENTS_COLLECTION);
  await col.createIndex({ id: 1 }, { unique: true });
  await col.createIndex({ providerEventKey: 1 }, { unique: true });
  await col.createIndex({ payloadHash: 1 }, { unique: true });
  await col.createIndex({ providerMessageId: 1, eventType: 1 });
  await col.createIndex({ receivedAt: -1 });
  await col.createIndex({ processingStatus: 1, receivedAt: -1 });
  indexesEnsured = true;
}

export type InsertWebhookEventResult =
  | { duplicate: false; event: InteraktWebhookEvent }
  | { duplicate: true; event: InteraktWebhookEvent };

export async function insertWebhookEvent(
  db: Db,
  input: {
    rawBody: string;
    rawPayload: InteraktProviderWebhookBody;
    signatureValid: boolean;
  },
): Promise<InsertWebhookEventResult> {
  await ensureInteraktWebhookIndexes(db);

  const payloadHash = sha256Hex(input.rawBody);
  const eventType = String(input.rawPayload.type || input.rawPayload.field || 'unknown');
  const providerMessageId = input.rawPayload.data?.message?.id
    ? String(input.rawPayload.data.message.id)
    : null;
  const providerCustomerId = input.rawPayload.data?.customer?.id
    ? String(input.rawPayload.data.customer.id)
    : null;
  const webhookTimestamp = input.rawPayload.timestamp
    ? String(input.rawPayload.timestamp)
    : null;

  const providerEventKey = buildProviderEventKey({
    payloadHash,
    eventType,
    providerMessageId,
    webhookTimestamp,
  });

  const now = new Date().toISOString();
  const event: InteraktWebhookEvent = {
    id: uuidv4(),
    provider: 'interakt',
    eventType,
    providerEventKey,
    providerMessageId,
    providerCustomerId,
    webhookTimestamp,
    receivedAt: now,
    signatureValid: input.signatureValid,
    processingStatus: 'accepted',
    processingError: null,
    processedAt: null,
    rawPayload: input.rawPayload,
    payloadHash,
  };

  try {
    await db.collection(INTERAKT_WEBHOOK_EVENTS_COLLECTION).insertOne(event);
    return { duplicate: false, event };
  } catch (error) {
    const code = (error as { code?: number })?.code;
    if (code === 11000) {
      const existing = (await db.collection(INTERAKT_WEBHOOK_EVENTS_COLLECTION).findOne(
        { $or: [{ providerEventKey }, { payloadHash }] },
        { projection: { _id: 0 } },
      )) as unknown as InteraktWebhookEvent | null;
      if (existing) {
        return { duplicate: true, event: existing };
      }
    }
    throw error;
  }
}

export async function getWebhookEventById(
  db: Db,
  id: string,
): Promise<InteraktWebhookEvent | null> {
  await ensureInteraktWebhookIndexes(db);
  return db.collection(INTERAKT_WEBHOOK_EVENTS_COLLECTION).findOne(
    { id },
    { projection: { _id: 0 } },
  ) as unknown as Promise<InteraktWebhookEvent | null>;
}

export async function markWebhookEventStatus(
  db: Db,
  id: string,
  processingStatus: InteraktWebhookProcessingStatus,
  processingError?: string | null,
): Promise<void> {
  await ensureInteraktWebhookIndexes(db);
  const patch: Record<string, unknown> = {
    processingStatus,
    processingError: processingError || null,
  };
  if (processingStatus === 'processed' || processingStatus === 'ignored' || processingStatus === 'failed') {
    patch.processedAt = new Date().toISOString();
  }
  await db.collection(INTERAKT_WEBHOOK_EVENTS_COLLECTION).updateOne({ id }, { $set: patch });
}

export async function getInteraktDatabase(): Promise<Db> {
  return getDb() as Promise<Db>;
}
