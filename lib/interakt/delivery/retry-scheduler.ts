import { v4 as uuidv4 } from 'uuid';
import type { Db } from 'mongodb';
import { computeRetryDelayMs, getDeliveryRetryConfig } from '@/lib/interakt/delivery/config';
import type { DeliveryRetryJob } from '@/lib/interakt/delivery/types';

export const INTERAKT_DELIVERY_RETRIES_COLLECTION = 'interakt_delivery_retries';

let indexesEnsured = false;

export async function ensureRetryIndexes(db: Db): Promise<void> {
  if (indexesEnsured) return;
  const col = db.collection(INTERAKT_DELIVERY_RETRIES_COLLECTION);
  await col.createIndex({ id: 1 }, { unique: true });
  await col.createIndex({ idempotencyKey: 1 }, { unique: true });
  await col.createIndex({ status: 1, scheduledFor: 1 });
  await col.createIndex({ recipientId: 1, status: 1 });
  await col.createIndex({ campaignId: 1, status: 1 });
  indexesEnsured = true;
}

export async function scheduleDeliveryRetry(
  db: Db,
  input: {
    campaignId: string;
    recipientId: string;
    attemptId: string;
    normalizedPhone: string;
    attemptNumber: number;
    scheduledFor?: string;
  },
): Promise<{ job: DeliveryRetryJob; created: boolean }> {
  await ensureRetryIndexes(db);
  const config = getDeliveryRetryConfig();
  const delay = computeRetryDelayMs(input.attemptNumber, config);
  const now = new Date().toISOString();
  const scheduledFor =
    input.scheduledFor || new Date(Date.now() + delay).toISOString();
  const idempotencyKey = `retry:${input.recipientId}:attempt:${input.attemptNumber}`;

  const job: DeliveryRetryJob = {
    id: uuidv4(),
    campaignId: input.campaignId,
    recipientId: input.recipientId,
    attemptId: input.attemptId,
    normalizedPhone: input.normalizedPhone,
    scheduledFor,
    status: 'queued',
    attemptNumber: input.attemptNumber,
    maxAttempts: config.maxAttempts,
    idempotencyKey,
    lastError: null,
    createdAt: now,
    updatedAt: now,
  };

  try {
    await db.collection(INTERAKT_DELIVERY_RETRIES_COLLECTION).insertOne(job);
    return { job, created: true };
  } catch (error) {
    const code = (error as { code?: number }).code;
    if (code === 11000) {
      const existing = (await db.collection(INTERAKT_DELIVERY_RETRIES_COLLECTION).findOne(
        { idempotencyKey },
        { projection: { _id: 0 } },
      )) as unknown as DeliveryRetryJob | null;
      if (existing) return { job: existing, created: false };
    }
    throw error;
  }
}

export async function cancelRetryJobsForRecipient(
  db: Db,
  recipientId: string,
  reason: string,
): Promise<number> {
  await ensureRetryIndexes(db);
  const now = new Date().toISOString();
  const result = await db.collection(INTERAKT_DELIVERY_RETRIES_COLLECTION).updateMany(
    { recipientId, status: { $in: ['queued'] } },
    {
      $set: {
        status: 'cancelled',
        lastError: reason.slice(0, 500),
        completedAt: now,
        updatedAt: now,
      },
    },
  );
  return result.modifiedCount;
}

export async function claimDueRetryJobs(
  db: Db,
  limit: number,
): Promise<DeliveryRetryJob[]> {
  await ensureRetryIndexes(db);
  const now = new Date().toISOString();
  const due = (await db
    .collection(INTERAKT_DELIVERY_RETRIES_COLLECTION)
    .find(
      { status: 'queued', scheduledFor: { $lte: now } },
      { projection: { _id: 0 } },
    )
    .sort({ scheduledFor: 1 })
    .limit(limit)
    .toArray()) as unknown as DeliveryRetryJob[];

  const claimed: DeliveryRetryJob[] = [];
  for (const job of due) {
    const result = await db.collection(INTERAKT_DELIVERY_RETRIES_COLLECTION).findOneAndUpdate(
      { id: job.id, status: 'queued' },
      {
        $set: {
          status: 'running',
          claimedAt: now,
          updatedAt: now,
        },
      },
      { returnDocument: 'after', projection: { _id: 0 } },
    );
    if (result) claimed.push(result as unknown as DeliveryRetryJob);
  }
  return claimed;
}

export async function markRetryJobStatus(
  db: Db,
  id: string,
  status: DeliveryRetryJob['status'],
  lastError?: string | null,
): Promise<void> {
  await ensureRetryIndexes(db);
  const now = new Date().toISOString();
  await db.collection(INTERAKT_DELIVERY_RETRIES_COLLECTION).updateOne(
    { id },
    {
      $set: {
        status,
        lastError: lastError ?? null,
        updatedAt: now,
        ...(status === 'succeeded' || status === 'failed' || status === 'cancelled' || status === 'skipped'
          ? { completedAt: now }
          : {}),
      },
    },
  );
}
