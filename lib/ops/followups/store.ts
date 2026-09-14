import { v4 as uuidv4 } from 'uuid';
import type { Db, Filter } from 'mongodb';
import { getDb } from '@/lib/mongodb';
import type { OpsFollowUpJob, FollowUpJobStatus, FollowUpTargetType } from '@/lib/ops/followups/types';
import { normalizeIndianMobile, isValidIndianMobile } from '@/lib/phone/indian-mobile';

export const OPS_FOLLOW_UP_JOBS_COLLECTION = 'ops_follow_up_jobs';

let indexesEnsured = false;

export async function ensureFollowUpIndexes(db: Db): Promise<void> {
  if (indexesEnsured) return;
  const col = db.collection(OPS_FOLLOW_UP_JOBS_COLLECTION);
  await col.createIndex({ id: 1 }, { unique: true });
  await col.createIndex({ idempotencyKey: 1 }, { unique: true });
  await col.createIndex({ status: 1, scheduledFor: 1 });
  await col.createIndex({ normalizedPhone: 1, scheduledFor: -1 });
  await col.createIndex({ targetType: 1, targetId: 1, createdAt: -1 });
  await col.createIndex({ createdAt: -1 });
  indexesEnsured = true;
}

export async function getFollowUpDatabase(): Promise<Db> {
  return getDb() as Promise<Db>;
}

export async function enqueueFollowUpJob(
  db: Db,
  input: {
    targetType: FollowUpTargetType;
    targetId: string;
    targetSource?: string;
    phone: string;
    conversationId?: string;
    templateName: string;
    languageCode?: string;
    bodyValues?: string[];
    scheduledFor: string;
    createdBy: string;
    idempotencyKey: string;
    maxAttempts?: number;
  },
): Promise<{ job: OpsFollowUpJob; created: boolean }> {
  await ensureFollowUpIndexes(db);
  const normalizedPhone = normalizeIndianMobile(input.phone);
  if (!isValidIndianMobile(normalizedPhone)) {
    throw Object.assign(new Error('Invalid follow-up phone number.'), { status: 400 });
  }

  const now = new Date().toISOString();
  const job: OpsFollowUpJob = {
    id: uuidv4(),
    targetType: input.targetType,
    targetId: input.targetId,
    targetSource: input.targetSource,
    phone: input.phone,
    normalizedPhone,
    conversationId: input.conversationId,
    templateName: input.templateName,
    languageCode: input.languageCode || 'en',
    bodyValues: input.bodyValues || [],
    scheduledFor: input.scheduledFor,
    status: 'queued',
    attempt: 0,
    maxAttempts: input.maxAttempts || 3,
    idempotencyKey: input.idempotencyKey,
    createdBy: input.createdBy,
    createdAt: now,
    updatedAt: now,
  };

  try {
    await db.collection(OPS_FOLLOW_UP_JOBS_COLLECTION).insertOne(job);
    return { job, created: true };
  } catch (error) {
    const code = (error as { code?: number }).code;
    if (code === 11000) {
      const existing = (await db.collection(OPS_FOLLOW_UP_JOBS_COLLECTION).findOne(
        { idempotencyKey: input.idempotencyKey },
        { projection: { _id: 0 } },
      )) as unknown as OpsFollowUpJob | null;
      if (existing) return { job: existing, created: false };
    }
    throw error;
  }
}

export async function listFollowUpJobs(
  db: Db,
  filters: { status?: FollowUpJobStatus; limit?: number } = {},
): Promise<OpsFollowUpJob[]> {
  await ensureFollowUpIndexes(db);
  const query: Filter<OpsFollowUpJob> = {};
  if (filters.status) query.status = filters.status;
  return (await db
    .collection(OPS_FOLLOW_UP_JOBS_COLLECTION)
    .find(query, { projection: { _id: 0 } })
    .sort({ scheduledFor: 1 })
    .limit(filters.limit || 100)
    .toArray()) as unknown as OpsFollowUpJob[];
}

export async function cancelFollowUpJob(
  db: Db,
  id: string,
): Promise<OpsFollowUpJob | null> {
  await ensureFollowUpIndexes(db);
  const now = new Date().toISOString();
  const result = await db.collection(OPS_FOLLOW_UP_JOBS_COLLECTION).findOneAndUpdate(
    { id, status: { $in: ['queued', 'retrying'] } },
    { $set: { status: 'cancelled', cancelledAt: now, updatedAt: now } },
    { returnDocument: 'after', projection: { _id: 0 } },
  );
  return (result as unknown as OpsFollowUpJob) || null;
}

export async function rescheduleFollowUpJob(
  db: Db,
  id: string,
  scheduledFor: string,
): Promise<OpsFollowUpJob | null> {
  await ensureFollowUpIndexes(db);
  const now = new Date().toISOString();
  const result = await db.collection(OPS_FOLLOW_UP_JOBS_COLLECTION).findOneAndUpdate(
    { id, status: { $in: ['queued', 'retrying', 'failed'] } },
    {
      $set: {
        scheduledFor,
        status: 'queued',
        lastError: undefined,
        updatedAt: now,
      },
    },
    { returnDocument: 'after', projection: { _id: 0 } },
  );
  return (result as unknown as OpsFollowUpJob) || null;
}

export async function claimDueFollowUpJobs(db: Db, limit = 10): Promise<OpsFollowUpJob[]> {
  await ensureFollowUpIndexes(db);
  const now = new Date().toISOString();
  const due = (await db
    .collection(OPS_FOLLOW_UP_JOBS_COLLECTION)
    .find(
      {
        status: { $in: ['queued', 'retrying'] },
        scheduledFor: { $lte: now },
      },
      { projection: { _id: 0 } },
    )
    .sort({ scheduledFor: 1 })
    .limit(limit)
    .toArray()) as unknown as OpsFollowUpJob[];

  const claimed: OpsFollowUpJob[] = [];
  for (const job of due) {
    const result = await db.collection(OPS_FOLLOW_UP_JOBS_COLLECTION).findOneAndUpdate(
      { id: job.id, status: { $in: ['queued', 'retrying'] } },
      {
        $set: { status: 'running', updatedAt: now },
        $inc: { attempt: 1 },
      },
      { returnDocument: 'after', projection: { _id: 0 } },
    );
    if (result) claimed.push(result as unknown as OpsFollowUpJob);
  }
  return claimed;
}

export async function markFollowUpSucceeded(
  db: Db,
  id: string,
  providerMessageId: string,
): Promise<void> {
  const now = new Date().toISOString();
  await db.collection(OPS_FOLLOW_UP_JOBS_COLLECTION).updateOne(
    { id },
    {
      $set: {
        status: 'succeeded',
        providerMessageId,
        completedAt: now,
        updatedAt: now,
        lastError: null,
      },
    },
  );
}

export async function markFollowUpFailed(
  db: Db,
  job: OpsFollowUpJob,
  errorMessage: string,
): Promise<void> {
  const now = new Date().toISOString();
  const retry = job.attempt < job.maxAttempts;
  await db.collection(OPS_FOLLOW_UP_JOBS_COLLECTION).updateOne(
    { id: job.id },
    {
      $set: {
        status: retry ? 'retrying' : 'failed',
        lastError: errorMessage.slice(0, 500),
        updatedAt: now,
        ...(retry
          ? { scheduledFor: new Date(Date.now() + job.attempt * 5 * 60_000).toISOString() }
          : { completedAt: now }),
      },
    },
  );
}
