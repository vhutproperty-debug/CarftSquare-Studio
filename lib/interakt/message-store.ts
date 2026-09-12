import { v4 as uuidv4 } from 'uuid';
import type { Db } from 'mongodb';
import type {
  InteraktMediaRef,
  InteraktMessage,
  InteraktMessageDirection,
  InteraktMessageStatus,
  InteraktProviderMessage,
  InteraktStatusTimestamps,
} from '@/lib/interakt/types';
import { shouldApplyMessageStatus } from '@/lib/interakt/status-precedence';

export const INTERAKT_MESSAGES_COLLECTION = 'interakt_messages';

let indexesEnsured = false;

export async function ensureInteraktMessageIndexes(db: Db): Promise<void> {
  if (indexesEnsured) return;
  const col = db.collection(INTERAKT_MESSAGES_COLLECTION);
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
): Promise<InteraktMessage | null> {
  await ensureInteraktMessageIndexes(db);
  return db.collection(INTERAKT_MESSAGES_COLLECTION).findOne(
    { providerMessageId },
    { projection: { _id: 0 } },
  ) as unknown as Promise<InteraktMessage | null>;
}

function buildMedia(raw: InteraktProviderMessage): InteraktMediaRef | null {
  if (!raw.media_url) return null;
  return { url: raw.media_url, mediaUrl: raw.media_url };
}

export async function upsertInteraktMessage(
  db: Db,
  input: {
    conversationId: string;
    providerMessageId: string;
    providerCustomerId: string | null;
    direction: InteraktMessageDirection;
    messageType: string;
    bodyText: string | null;
    status: InteraktMessageStatus;
    statusTimestamps: InteraktStatusTimestamps;
    failure: InteraktMessage['failure'];
    callbackData: string | null;
    normalizedPhone: string;
    businessWaNumber: string;
    rawMessage: InteraktProviderMessage;
    rawEventType: string;
  },
): Promise<{ message: InteraktMessage; created: boolean }> {
  await ensureInteraktMessageIndexes(db);
  const existing = await getMessageByProviderId(db, input.providerMessageId);
  const now = new Date().toISOString();

  if (!existing) {
    const message: InteraktMessage = {
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
      await db.collection(INTERAKT_MESSAGES_COLLECTION).insertOne(message);
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
  existing: InteraktMessage,
  input: {
    conversationId: string;
    providerCustomerId: string | null;
    direction: InteraktMessageDirection;
    messageType: string;
    bodyText: string | null;
    status: InteraktMessageStatus;
    statusTimestamps: InteraktStatusTimestamps;
    failure: InteraktMessage['failure'];
    callbackData: string | null;
    rawMessage: InteraktProviderMessage;
    rawEventType: string;
  },
): Promise<{ message: InteraktMessage; created: boolean }> {
  const now = new Date().toISOString();
  const applyStatus = shouldApplyMessageStatus(existing.status, input.status);

  const statusTimestamps: InteraktStatusTimestamps = {
    ...existing.statusTimestamps,
  };
  for (const key of Object.keys(input.statusTimestamps) as Array<keyof InteraktStatusTimestamps>) {
    const value = input.statusTimestamps[key];
    if (value) statusTimestamps[key] = value;
  }

  const patch: Partial<InteraktMessage> = {
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
  if (!existing.media && input.rawMessage.media_url) {
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

  await db.collection(INTERAKT_MESSAGES_COLLECTION).updateOne(
    { id: existing.id },
    { $set: patch },
  );

  return { message: { ...existing, ...patch }, created: false };
}
