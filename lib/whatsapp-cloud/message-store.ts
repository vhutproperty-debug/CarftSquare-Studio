import { v4 as uuidv4 } from 'uuid';
import type { Db } from 'mongodb';
import type {
  WaMediaRef,
  WaMessage,
  WaMessageDirection,
  WaMessageStatus,
  WaProviderMessage,
  WaStatusTimestamps,
} from '@/lib/whatsapp-cloud/types';
import { shouldApplyMessageStatus } from '@/lib/whatsapp-cloud/status-precedence';

export const WA_MESSAGES_COLLECTION = 'wa_messages';

let indexesEnsured = false;

export async function ensureWaMessageIndexes(db: Db): Promise<void> {
  if (indexesEnsured) return;
  const col = db.collection(WA_MESSAGES_COLLECTION);
  await col.createIndex({ id: 1 }, { unique: true });
  await col.createIndex({ providerMessageId: 1 }, { unique: true });
  await col.createIndex({ conversationId: 1, createdAt: -1 });
  await col.createIndex({ normalizedPhone: 1, createdAt: -1 });
  await col.createIndex({ direction: 1, status: 1 });
  await col.createIndex({ conversationId: 1, direction: 1, status: 1 });
  await col.createIndex({ updatedAt: -1 });
  indexesEnsured = true;
}

export async function getMessageByProviderId(
  db: Db,
  providerMessageId: string,
): Promise<WaMessage | null> {
  await ensureWaMessageIndexes(db);
  return db.collection(WA_MESSAGES_COLLECTION).findOne(
    { providerMessageId },
    { projection: { _id: 0 } },
  ) as unknown as Promise<WaMessage | null>;
}

function buildMedia(raw: WaProviderMessage): WaMediaRef | null {
  if (!raw.media_url && !raw.media_id) return null;
  return {
    id: raw.media_id || undefined,
    url: raw.media_url || undefined,
    mediaUrl: raw.media_url || undefined,
    mimeType: raw.mime || undefined,
    fileName: raw.filename || undefined,
  };
}

export async function upsertWaMessage(
  db: Db,
  input: {
    conversationId: string;
    providerMessageId: string;
    providerCustomerId: string | null;
    direction: WaMessageDirection;
    messageType: string;
    bodyText: string | null;
    status: WaMessageStatus;
    statusTimestamps: WaStatusTimestamps;
    failure: WaMessage['failure'];
    callbackData: string | null;
    normalizedPhone: string;
    businessWaNumber: string;
    rawMessage: WaProviderMessage;
    rawEventType: string;
  },
): Promise<{ message: WaMessage; created: boolean }> {
  await ensureWaMessageIndexes(db);
  const existing = await getMessageByProviderId(db, input.providerMessageId);
  const now = new Date().toISOString();

  if (!existing) {
    const message: WaMessage = {
      id: uuidv4(),
      conversationId: input.conversationId,
      providerMessageId: input.providerMessageId,
      providerCustomerId: input.providerCustomerId,
      direction: input.direction,
      messageType: input.messageType,
      bodyText: input.bodyText,
      media: buildMedia(input.rawMessage),
      status: input.status,
      statusTimestamps: input.statusTimestamps,
      failure: input.failure,
      callbackData: input.callbackData,
      normalizedPhone: input.normalizedPhone,
      businessWaNumber: input.businessWaNumber,
      rawMessage: input.rawMessage,
      rawEventType: input.rawEventType,
      createdAt: now,
      updatedAt: now,
    };

    try {
      await db.collection(WA_MESSAGES_COLLECTION).insertOne(message);
      return { message, created: true };
    } catch (error) {
      const code = (error as { code?: number })?.code;
      if (code === 11000) {
        const raced = await getMessageByProviderId(db, input.providerMessageId);
        if (raced) {
          return applyStatusUpdate(db, raced, input);
        }
      }
      throw error;
    }
  }

  return applyStatusUpdate(db, existing, input);
}

async function applyStatusUpdate(
  db: Db,
  existing: WaMessage,
  input: {
    conversationId: string;
    providerCustomerId: string | null;
    direction: WaMessageDirection;
    messageType: string;
    bodyText: string | null;
    status: WaMessageStatus;
    statusTimestamps: WaStatusTimestamps;
    failure: WaMessage['failure'];
    callbackData: string | null;
    rawMessage: WaProviderMessage;
    rawEventType: string;
  },
): Promise<{ message: WaMessage; created: boolean }> {
  const now = new Date().toISOString();
  const applyStatus = shouldApplyMessageStatus(existing.status, input.status);

  const statusTimestamps: WaStatusTimestamps = {
    ...existing.statusTimestamps,
  };
  for (const key of Object.keys(input.statusTimestamps) as Array<keyof WaStatusTimestamps>) {
    const value = input.statusTimestamps[key];
    if (value) statusTimestamps[key] = value;
  }

  const patch: Partial<WaMessage> = {
    updatedAt: now,
    rawEventType: input.rawEventType,
    rawMessage: input.rawMessage || existing.rawMessage,
    statusTimestamps,
  };

  if (applyStatus) {
    patch.status = input.status;
  }

  if (!existing.bodyText && input.bodyText) {
    patch.bodyText = input.bodyText;
  }
  if (!existing.media && (input.rawMessage.media_url || input.rawMessage.media_id)) {
    patch.media = buildMedia(input.rawMessage);
  }
  if (!existing.callbackData && input.callbackData) {
    patch.callbackData = input.callbackData;
  }
  if (input.failure && (applyStatus || input.status === 'failed')) {
    patch.failure = input.failure;
  }
  if (input.providerCustomerId && !existing.providerCustomerId) {
    patch.providerCustomerId = input.providerCustomerId;
  }
  if (input.messageType && input.messageType !== 'Unknown') {
    patch.messageType = input.messageType;
  }

  await db.collection(WA_MESSAGES_COLLECTION).updateOne(
    { id: existing.id },
    { $set: patch },
  );

  return { message: { ...existing, ...patch }, created: false };
}
