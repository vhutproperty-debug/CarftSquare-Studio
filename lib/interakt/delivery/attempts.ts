import { v4 as uuidv4 } from 'uuid';
import type { Db } from 'mongodb';
import type { DeliveryAttempt, DeliveryState, FailureClass } from '@/lib/interakt/delivery/types';

export const INTERAKT_MESSAGE_ATTEMPTS_COLLECTION = 'interakt_message_attempts';

let indexesEnsured = false;

export async function ensureAttemptIndexes(db: Db): Promise<void> {
  if (indexesEnsured) return;
  const col = db.collection(INTERAKT_MESSAGE_ATTEMPTS_COLLECTION);
  await col.createIndex({ id: 1 }, { unique: true });
  await col.createIndex({ submitIdempotencyKey: 1 }, { unique: true });
  await col.createIndex({ providerMessageId: 1 }, { sparse: true });
  await col.createIndex({ campaignId: 1, recipientId: 1, attemptNumber: 1 }, { unique: true });
  await col.createIndex({ recipientId: 1, createdAt: -1 });
  await col.createIndex({ deliveryState: 1, nextRetryAt: 1 });
  indexesEnsured = true;
}

export async function createAttempt(
  db: Db,
  input: {
    campaignId: string;
    recipientId: string;
    attemptNumber: number;
    normalizedPhone: string;
    templateName: string;
    languageCode: string;
    bodyValues: string[];
    submitIdempotencyKey: string;
    callbackData: string;
    deliveryState?: DeliveryState;
  },
): Promise<{ attempt: DeliveryAttempt; created: boolean }> {
  await ensureAttemptIndexes(db);
  const now = new Date().toISOString();
  const attempt: DeliveryAttempt = {
    id: uuidv4(),
    campaignId: input.campaignId,
    recipientId: input.recipientId,
    attemptNumber: input.attemptNumber,
    providerMessageId: null,
    normalizedPhone: input.normalizedPhone,
    templateName: input.templateName,
    languageCode: input.languageCode,
    bodyValues: input.bodyValues,
    submitIdempotencyKey: input.submitIdempotencyKey,
    submittedAt: null,
    apiResponse: null,
    providerStatus: null,
    deliveryState: input.deliveryState || 'SUBMITTING',
    failureCode: null,
    failureReason: null,
    failureClass: null,
    nextRetryAt: null,
    completedAt: null,
    callbackData: input.callbackData,
    createdAt: now,
    updatedAt: now,
  };

  try {
    await db.collection(INTERAKT_MESSAGE_ATTEMPTS_COLLECTION).insertOne(attempt);
    return { attempt, created: true };
  } catch (error) {
    const code = (error as { code?: number }).code;
    if (code === 11000) {
      const existing = (await db.collection(INTERAKT_MESSAGE_ATTEMPTS_COLLECTION).findOne(
        {
          $or: [
            { submitIdempotencyKey: input.submitIdempotencyKey },
            {
              campaignId: input.campaignId,
              recipientId: input.recipientId,
              attemptNumber: input.attemptNumber,
            },
          ],
        },
        { projection: { _id: 0 } },
      )) as unknown as DeliveryAttempt | null;
      if (existing) return { attempt: existing, created: false };
    }
    throw error;
  }
}

export async function updateAttempt(
  db: Db,
  id: string,
  patch: Partial<DeliveryAttempt>,
): Promise<DeliveryAttempt | null> {
  await ensureAttemptIndexes(db);
  const result = await db.collection(INTERAKT_MESSAGE_ATTEMPTS_COLLECTION).findOneAndUpdate(
    { id },
    { $set: { ...patch, updatedAt: new Date().toISOString() } },
    { returnDocument: 'after', projection: { _id: 0 } },
  );
  return (result as unknown as DeliveryAttempt) || null;
}

export async function findAttemptByProviderMessageId(
  db: Db,
  providerMessageId: string,
): Promise<DeliveryAttempt | null> {
  await ensureAttemptIndexes(db);
  return (await db.collection(INTERAKT_MESSAGE_ATTEMPTS_COLLECTION).findOne(
    { providerMessageId },
    { projection: { _id: 0 } },
  )) as unknown as DeliveryAttempt | null;
}

export async function findAttemptById(
  db: Db,
  id: string,
): Promise<DeliveryAttempt | null> {
  await ensureAttemptIndexes(db);
  return (await db.collection(INTERAKT_MESSAGE_ATTEMPTS_COLLECTION).findOne(
    { id },
    { projection: { _id: 0 } },
  )) as unknown as DeliveryAttempt | null;
}

export async function listAttemptsForRecipient(
  db: Db,
  recipientId: string,
): Promise<DeliveryAttempt[]> {
  await ensureAttemptIndexes(db);
  return (await db
    .collection(INTERAKT_MESSAGE_ATTEMPTS_COLLECTION)
    .find({ recipientId }, { projection: { _id: 0 } })
    .sort({ attemptNumber: 1 })
    .toArray()) as unknown as DeliveryAttempt[];
}

export async function getLatestAttempt(
  db: Db,
  recipientId: string,
): Promise<DeliveryAttempt | null> {
  await ensureAttemptIndexes(db);
  return (await db.collection(INTERAKT_MESSAGE_ATTEMPTS_COLLECTION).findOne(
    { recipientId },
    { projection: { _id: 0 }, sort: { attemptNumber: -1 } },
  )) as unknown as DeliveryAttempt | null;
}

export async function markAttemptOutcome(
  db: Db,
  id: string,
  input: {
    providerMessageId?: string | null;
    apiResponse?: unknown;
    providerStatus?: string | null;
    deliveryState: DeliveryState;
    failureCode?: string | null;
    failureReason?: string | null;
    failureClass?: FailureClass | null;
    nextRetryAt?: string | null;
    submittedAt?: string | null;
    completedAt?: string | null;
    craftSquareMessageId?: string;
  },
): Promise<DeliveryAttempt | null> {
  return updateAttempt(db, id, {
    providerMessageId: input.providerMessageId ?? undefined,
    apiResponse: input.apiResponse,
    providerStatus: input.providerStatus ?? null,
    deliveryState: input.deliveryState,
    failureCode: input.failureCode ?? null,
    failureReason: input.failureReason ?? null,
    failureClass: input.failureClass ?? null,
    nextRetryAt: input.nextRetryAt ?? null,
    submittedAt: input.submittedAt ?? undefined,
    completedAt: input.completedAt ?? null,
    craftSquareMessageId: input.craftSquareMessageId,
  } as Partial<DeliveryAttempt>);
}
