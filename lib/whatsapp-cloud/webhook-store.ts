import { v4 as uuidv4 } from 'uuid';
import type { Db } from 'mongodb';
import { getDb } from '@/lib/mongodb';
import type {
  WaProviderWebhookBody,
  WaWebhookEvent,
  WaWebhookProcessingStatus,
} from '@/lib/whatsapp-cloud/types';
import { buildProviderEventKey, sha256Hex } from '@/lib/whatsapp-cloud/phone';

export const WA_WEBHOOK_EVENTS_COLLECTION = 'wa_webhook_events';

let indexesEnsured = false;

export async function ensureWaWebhookIndexes(db: Db): Promise<void> {
  if (indexesEnsured) return;
  const col = db.collection(WA_WEBHOOK_EVENTS_COLLECTION);
  await col.createIndex({ id: 1 }, { unique: true });
  await col.createIndex({ providerEventKey: 1 }, { unique: true });
  await col.createIndex({ payloadHash: 1 }, { unique: true });
  await col.createIndex({ providerMessageId: 1, eventType: 1 });
  await col.createIndex({ receivedAt: -1 });
  await col.createIndex({ processingStatus: 1, receivedAt: -1 });
  indexesEnsured = true;
}

export type InsertWebhookEventResult =
  | { duplicate: false; event: WaWebhookEvent }
  | { duplicate: true; event: WaWebhookEvent };

export async function insertWebhookEvent(
  db: Db,
  input: {
    rawBody: string;
    rawPayload: WaProviderWebhookBody;
    signatureValid: boolean;
  },
): Promise<InsertWebhookEventResult> {
  await ensureWaWebhookIndexes(db);

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
  const event: WaWebhookEvent = {
    id: uuidv4(),
    provider: 'whatsapp_cloud',
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
    await db.collection(WA_WEBHOOK_EVENTS_COLLECTION).insertOne(event);
    return { duplicate: false, event };
  } catch (error) {
    const code = (error as { code?: number })?.code;
    if (code === 11000) {
      const existing = (await db.collection(WA_WEBHOOK_EVENTS_COLLECTION).findOne(
        { $or: [{ providerEventKey }, { payloadHash }] },
        { projection: { _id: 0 } },
      )) as unknown as WaWebhookEvent | null;
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
): Promise<WaWebhookEvent | null> {
  await ensureWaWebhookIndexes(db);
  return db.collection(WA_WEBHOOK_EVENTS_COLLECTION).findOne(
    { id },
    { projection: { _id: 0 } },
  ) as unknown as Promise<WaWebhookEvent | null>;
}

export async function markWebhookEventStatus(
  db: Db,
  id: string,
  processingStatus: WaWebhookProcessingStatus,
  processingError?: string | null,
): Promise<void> {
  await ensureWaWebhookIndexes(db);
  const patch: Record<string, unknown> = {
    processingStatus,
    processingError: processingError || null,
  };
  if (processingStatus === 'processed' || processingStatus === 'ignored' || processingStatus === 'failed') {
    patch.processedAt = new Date().toISOString();
  }
  await db.collection(WA_WEBHOOK_EVENTS_COLLECTION).updateOne({ id }, { $set: patch });
}

export async function getWaDatabase(): Promise<Db> {
  return getDb() as Promise<Db>;
}

export async function insertCloudWebhookEvent(
  db: Db,
  input: {
    rawBody: string;
    eventType: string;
    providerEventKey: string;
    providerMessageId: string | null;
    waId: string | null;
    webhookTimestamp: string | null;
    rawPayload: unknown;
  },
): Promise<InsertWebhookEventResult> {
  await ensureWaWebhookIndexes(db);
  const payloadHash = sha256Hex(`${input.providerEventKey}\n${input.rawBody}`);
  const now = new Date().toISOString();
  const event: WaWebhookEvent = {
    id: uuidv4(),
    provider: 'whatsapp_cloud',
    eventType: input.eventType,
    providerEventKey: input.providerEventKey,
    providerMessageId: input.providerMessageId,
    providerCustomerId: input.waId,
    webhookTimestamp: input.webhookTimestamp,
    receivedAt: now,
    signatureValid: true,
    processingStatus: 'accepted',
    processingError: null,
    processedAt: null,
    rawPayload: input.rawPayload,
    payloadHash,
  };

  try {
    await db.collection(WA_WEBHOOK_EVENTS_COLLECTION).insertOne(event);
    return { duplicate: false, event };
  } catch (error) {
    const code = (error as { code?: number })?.code;
    if (code === 11000) {
      const existing = (await db.collection(WA_WEBHOOK_EVENTS_COLLECTION).findOne(
        { providerEventKey: input.providerEventKey },
        { projection: { _id: 0 } },
      )) as unknown as WaWebhookEvent | null;
      if (existing) return { duplicate: true, event: existing };
    }
    throw error;
  }
}

export async function getLastWebhookReceivedAt(db: Db): Promise<string | null> {
  await ensureWaWebhookIndexes(db);
  const row = await db.collection(WA_WEBHOOK_EVENTS_COLLECTION)
    .find({}, { projection: { _id: 0, receivedAt: 1 } })
    .sort({ receivedAt: -1 })
    .limit(1)
    .toArray();
  const at = row[0] && (row[0] as { receivedAt?: string }).receivedAt;
  return at || null;
}
