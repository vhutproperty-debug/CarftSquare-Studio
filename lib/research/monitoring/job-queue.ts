import { v4 as uuidv4 } from 'uuid';
import { RESEARCH_COLLECTIONS } from '@/lib/research/collections';
import { ensureMonitoringIndexes } from '@/lib/research/monitoring/indexes';
import type {
  WatchJob,
  WatchJobPhase,
  WatchJobStatus,
  WatchPriority,
} from '@/lib/research/monitoring/types';
import { ensureResearchIndexes, getResearchDatabase } from '@/lib/research/store';

const PRIORITY_RANK: Record<WatchPriority, number> = {
  critical: 4,
  high: 3,
  normal: 2,
  low: 1,
};

async function dbReady() {
  const db = await getResearchDatabase();
  await ensureResearchIndexes(db);
  await ensureMonitoringIndexes(db);
  return db;
}

export async function enqueueWatchJob(input: {
  workspaceId: string;
  watchId: string;
  priority: WatchPriority;
  scheduledFor?: string;
}): Promise<WatchJob> {
  const db = await dbReady();
  const now = new Date().toISOString();
  const job: WatchJob = {
    id: uuidv4(),
    workspaceId: input.workspaceId,
    watchId: input.watchId,
    status: 'queued',
    phase: 'queued',
    priority: input.priority,
    attempt: 0,
    maxAttempts: 3,
    scheduledFor: input.scheduledFor || now,
    createdAt: now,
    updatedAt: now,
  };
  await db.collection(RESEARCH_COLLECTIONS.watchJobs).insertOne(job);
  return job;
}

export async function getJobById(id: string): Promise<WatchJob | null> {
  const db = await dbReady();
  return db.collection<WatchJob>(RESEARCH_COLLECTIONS.watchJobs).findOne({ id });
}

export async function listJobs(
  workspaceId: string,
  opts?: { status?: WatchJobStatus; limit?: number },
): Promise<WatchJob[]> {
  const db = await dbReady();
  const filter: Record<string, unknown> = { workspaceId };
  if (opts?.status) filter.status = opts.status;
  return db
    .collection<WatchJob>(RESEARCH_COLLECTIONS.watchJobs)
    .find(filter)
    .sort({ createdAt: -1 })
    .limit(opts?.limit || 50)
    .toArray();
}

export async function claimNextJob(): Promise<WatchJob | null> {
  const db = await dbReady();
  const now = new Date().toISOString();
  // Priority queue: critical first, then earliest scheduled
  const candidates = await db
    .collection<WatchJob>(RESEARCH_COLLECTIONS.watchJobs)
    .find({
      status: { $in: ['queued', 'retrying'] },
      scheduledFor: { $lte: now },
    })
    .toArray();

  candidates.sort((a, b) => {
    const pr = PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority];
    if (pr !== 0) return pr;
    return a.scheduledFor.localeCompare(b.scheduledFor);
  });

  for (const candidate of candidates) {
    const res = await db.collection<WatchJob>(RESEARCH_COLLECTIONS.watchJobs).findOneAndUpdate(
      { id: candidate.id, status: { $in: ['queued', 'retrying'] } },
      {
        $set: {
          status: 'running',
          phase: 'delta_compare',
          startedAt: now,
          updatedAt: now,
        },
        $inc: { attempt: 1 },
      },
      { returnDocument: 'after' },
    );
    if (res) return res as WatchJob;
  }
  return null;
}

export async function updateJob(
  id: string,
  patch: Partial<
    Pick<
      WatchJob,
      | 'status'
      | 'phase'
      | 'errorMessage'
      | 'finishedAt'
      | 'stats'
      | 'evidence'
      | 'planSummary'
      | 'workerType'
    >
  >,
): Promise<void> {
  const db = await dbReady();
  await db.collection(RESEARCH_COLLECTIONS.watchJobs).updateOne(
    { id },
    { $set: { ...patch, updatedAt: new Date().toISOString() } },
  );
}

export async function setJobPhase(id: string, phase: WatchJobPhase): Promise<void> {
  await updateJob(id, { phase });
}

export async function countJobsByStatus(workspaceId: string): Promise<Record<string, number>> {
  const db = await dbReady();
  const rows = await db
    .collection(RESEARCH_COLLECTIONS.watchJobs)
    .aggregate([
      { $match: { workspaceId } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ])
    .toArray();
  const out: Record<string, number> = {};
  for (const row of rows) out[String(row._id)] = row.count as number;
  return out;
}
