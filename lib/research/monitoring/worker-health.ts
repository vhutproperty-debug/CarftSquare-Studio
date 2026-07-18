import { v4 as uuidv4 } from 'uuid';
import { RESEARCH_COLLECTIONS } from '@/lib/research/collections';
import { ensureMonitoringIndexes } from '@/lib/research/monitoring/indexes';
import type {
  SystemHealthReport,
  WatchJobWorkerType,
  WorkerHeartbeat,
} from '@/lib/research/monitoring/types';
import { listPortalConnections } from '@/lib/research/store/portal-connections';
import { ensureResearchIndexes, getResearchDatabase } from '@/lib/research/store';
import { RESEARCH_PORTALS } from '@/lib/research/browser/config';

const STALE_MS = 3 * 60 * 1000;

async function dbReady() {
  const db = await getResearchDatabase();
  await ensureResearchIndexes(db);
  await ensureMonitoringIndexes(db);
  return db;
}

export async function recordWorkerHeartbeat(input: {
  workerId: string;
  workerType: WatchJobWorkerType;
  status?: 'idle' | 'busy' | 'error';
  workspaceId?: string;
  host?: string;
  metrics?: Record<string, unknown>;
}): Promise<WorkerHeartbeat> {
  const db = await dbReady();
  const now = new Date().toISOString();
  const existing = await db.collection<WorkerHeartbeat>(RESEARCH_COLLECTIONS.workerHeartbeats).findOne({
    workerId: input.workerId,
    workerType: input.workerType,
  });

  if (existing) {
    await db.collection(RESEARCH_COLLECTIONS.workerHeartbeats).updateOne(
      { id: existing.id },
      {
        $set: {
          status: input.status || 'idle',
          workspaceId: input.workspaceId,
          host: input.host,
          metrics: input.metrics,
          lastHeartbeatAt: now,
          updatedAt: now,
        },
      },
    );
    return { ...existing, status: input.status || 'idle', lastHeartbeatAt: now, updatedAt: now };
  }

  const doc: WorkerHeartbeat = {
    id: uuidv4(),
    workspaceId: input.workspaceId,
    workerId: input.workerId,
    workerType: input.workerType,
    status: input.status || 'idle',
    host: input.host,
    metrics: input.metrics,
    lastHeartbeatAt: now,
    createdAt: now,
    updatedAt: now,
  };
  await db.collection(RESEARCH_COLLECTIONS.workerHeartbeats).insertOne(doc);
  return doc;
}

export async function listWorkerHeartbeats(): Promise<WorkerHeartbeat[]> {
  const db = await dbReady();
  return db
    .collection<WorkerHeartbeat>(RESEARCH_COLLECTIONS.workerHeartbeats)
    .find({})
    .sort({ lastHeartbeatAt: -1 })
    .limit(100)
    .toArray();
}

function heartbeatStatus(at: string): 'online' | 'stale' | 'offline' {
  const age = Date.now() - new Date(at).getTime();
  if (age <= STALE_MS) return 'online';
  if (age <= STALE_MS * 5) return 'stale';
  return 'offline';
}

export async function getSystemHealthReport(workspaceId: string): Promise<SystemHealthReport> {
  const db = await dbReady();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const checkedAt = new Date().toISOString();

  const [jobs, retries, alerts, kgUpdates, audits, heartbeats, connections] = await Promise.all([
    db
      .collection(RESEARCH_COLLECTIONS.watchJobs)
      .find({ workspaceId, createdAt: { $gte: since } })
      .project({ status: 1, evidence: 1 })
      .toArray(),
    db.collection(RESEARCH_COLLECTIONS.watchJobs).countDocuments({
      workspaceId,
      status: 'retrying',
      updatedAt: { $gte: since },
    }),
    db.collection(RESEARCH_COLLECTIONS.notifications).countDocuments({
      workspaceId,
      createdAt: { $gte: since },
    }),
    db.collection(RESEARCH_COLLECTIONS.kgObservations).countDocuments({
      workspaceId,
      observedAt: { $gte: since },
    }),
    db
      .collection(RESEARCH_COLLECTIONS.monitorAudits)
      .find({
        workspaceId,
        createdAt: { $gte: since },
        action: { $in: ['watch_job_failed', 'browser_crash'] },
      })
      .project({ action: 1 })
      .toArray(),
    listWorkerHeartbeats(),
    listPortalConnections(workspaceId),
  ]);

  const completed = jobs.filter((j) => j.status === 'completed').length;
  const failed = jobs.filter((j) => j.status === 'failed').length;
  const terminal = completed + failed;
  const jobSuccessRate24h = terminal ? Math.round((completed / terminal) * 1000) / 10 : null;

  const portalOutcomes = jobs.flatMap((j) => {
    const outcomes = (j.evidence as { portalOutcomes?: Array<{ ok?: boolean }> } | undefined)
      ?.portalOutcomes;
    return outcomes || [];
  });
  const portalFails = portalOutcomes.filter((o) => o.ok === false).length;
  const portalFailureRate24h = portalOutcomes.length
    ? Math.round((portalFails / portalOutcomes.length) * 1000) / 10
    : null;

  const browserCrashCount24h = audits.filter((a) => a.action === 'browser_crash').length;

  const latencies = portalOutcomes
    .map((o) => (o as { latencyMs?: number }).latencyMs)
    .filter((n): n is number => typeof n === 'number');
  const avgConnectorLatencyMs = latencies.length
    ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
    : null;

  const workers = heartbeats.map((h) => ({
    workerType: h.workerType,
    workerId: h.workerId,
    status: heartbeatStatus(h.lastHeartbeatAt),
    lastHeartbeatAt: h.lastHeartbeatAt,
    metrics: h.metrics,
  }));

  const onlineWorkers = workers.filter((w) => w.status === 'online').length;
  let status: SystemHealthReport['status'] = 'healthy';
  if ((jobSuccessRate24h != null && jobSuccessRate24h < 50) || onlineWorkers === 0 && jobs.length > 0) {
    status = 'critical';
  } else if (
    (jobSuccessRate24h != null && jobSuccessRate24h < 80) ||
    (portalFailureRate24h != null && portalFailureRate24h > 40) ||
    workers.some((w) => w.status === 'stale')
  ) {
    status = 'degraded';
  }

  const byPortal = new Map(connections.map((c) => [c.portalKey, c.status]));
  const connectors = RESEARCH_PORTALS.map((p) => ({
    portal: p.key,
    status: byPortal.get(p.key) || 'disconnected',
  }));

  return {
    status,
    checkedAt,
    jobSuccessRate24h,
    portalFailureRate24h,
    retryCount24h: retries,
    alertThroughput24h: alerts,
    kgUpdateRate24h: kgUpdates,
    browserCrashCount24h,
    avgConnectorLatencyMs,
    workers,
    connectors,
  };
}
