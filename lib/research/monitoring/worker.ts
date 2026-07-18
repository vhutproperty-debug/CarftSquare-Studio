import { v4 as uuidv4 } from 'uuid';
import { hostname } from 'os';
import { RESEARCH_COLLECTIONS } from '@/lib/research/collections';
import { enrichKnowledgeGraph } from '@/lib/research/graph/enrichment';
import type { KgChange, KgProperty } from '@/lib/research/graph/types';
import { searchPortalsInParallel } from '@/lib/research/ai/parallel-search';
import { dedupeAcrossPortals } from '@/lib/research/ai/dedupe';
import { scoreListings } from '@/lib/research/ai/scoring';
import { generateAlertsFromChanges } from '@/lib/research/monitoring/alert-engine';
import {
  buildDeltaBaseline,
  classifyListingDelta,
} from '@/lib/research/monitoring/delta-mode';
import { publishInsightNotifications } from '@/lib/research/monitoring/insights';
import {
  claimNextJob,
  enqueueWatchJob,
  getJobById,
  setJobPhase,
  updateJob,
} from '@/lib/research/monitoring/job-queue';
import { planWatchCrawl } from '@/lib/research/monitoring/smart-planner';
import { computeWorkspaceTrends } from '@/lib/research/monitoring/trend-engine';
import { recordWorkerHeartbeat } from '@/lib/research/monitoring/worker-health';
import {
  computeNextRunAt,
  deriveWatchHealth,
  getWatchById,
  listDueWatches,
  updateWatch,
} from '@/lib/research/monitoring/watch-store';
import type { MonitorAudit, ResearchWatch, WatchJob } from '@/lib/research/monitoring/types';
import { ensureResearchIndexes, getResearchDatabase } from '@/lib/research/store';
import { ensureMonitoringIndexes } from '@/lib/research/monitoring/indexes';

const WORKER_ID = `monitor-${hostname()}-${process.pid}`;

async function audit(entry: Omit<MonitorAudit, 'id' | 'createdAt'>) {
  const db = await getResearchDatabase();
  await ensureResearchIndexes(db);
  await ensureMonitoringIndexes(db);
  await db.collection(RESEARCH_COLLECTIONS.monitorAudits).insertOne({
    id: uuidv4(),
    ...entry,
    createdAt: new Date().toISOString(),
  });
}

function seedFromId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i += 1) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h;
}

/**
 * Enqueue due watches into the durable job queue with staggered schedule offsets.
 */
export async function scheduleDueWatches(limit = 20): Promise<{ enqueued: number }> {
  await recordWorkerHeartbeat({
    workerId: WORKER_ID,
    workerType: 'scheduler',
    status: 'busy',
  });

  const due = await listDueWatches(limit);
  let enqueued = 0;
  for (let i = 0; i < due.length; i += 1) {
    const watch = due[i]!;
    // Stagger scheduledFor by priority bucket + index (seconds)
    const staggerSec = i * 8 + (watch.priority === 'critical' ? 0 : watch.priority === 'high' ? 2 : 5);
    const scheduledFor = new Date(Date.now() + staggerSec * 1000).toISOString();
    await enqueueWatchJob({
      workspaceId: watch.workspaceId,
      watchId: watch.id,
      priority: watch.priority,
      scheduledFor,
    });
    await updateWatch(watch.id, {
      nextRunAt: computeNextRunAt(watch.frequency, new Date(), seedFromId(watch.id)),
    });
    enqueued += 1;
    await audit({
      workspaceId: watch.workspaceId,
      action: 'watch_enqueued',
      watchId: watch.id,
      details: { frequency: watch.frequency, priority: watch.priority, scheduledFor },
    });
  }

  await recordWorkerHeartbeat({
    workerId: WORKER_ID,
    workerType: 'scheduler',
    status: 'idle',
    metrics: { enqueued },
  });
  return { enqueued };
}

/**
 * Process one queued monitoring job end-to-end with smart planning + delta crawl.
 */
export async function processNextWatchJob(): Promise<WatchJob | null> {
  const job = await claimNextJob();
  if (!job) return null;

  const started = Date.now();
  await recordWorkerHeartbeat({
    workerId: WORKER_ID,
    workerType: 'browser_crawl',
    status: 'busy',
    workspaceId: job.workspaceId,
    metrics: { jobId: job.id },
  });

  const watch = await getWatchById(job.watchId);
  if (!watch || watch.workspaceId !== job.workspaceId) {
    await updateJob(job.id, {
      status: 'failed',
      phase: 'done',
      errorMessage: 'Watch not found',
      finishedAt: new Date().toISOString(),
    });
    return getJobById(job.id);
  }

  if (watch.enabled === false || watch.status === 'paused' || watch.status === 'disabled') {
    await updateJob(job.id, {
      status: 'cancelled',
      phase: 'done',
      errorMessage: 'Watch paused or disabled',
      finishedAt: new Date().toISOString(),
    });
    return getJobById(job.id);
  }

  try {
    await setJobPhase(job.id, 'plan');
    await recordWorkerHeartbeat({
      workerId: WORKER_ID,
      workerType: 'health',
      status: 'busy',
      workspaceId: watch.workspaceId,
    });
    const plan = await planWatchCrawl(watch);
    await updateJob(job.id, {
      planSummary: {
        shouldCrawl: plan.shouldCrawl,
        reason: plan.reason,
        portalsToCrawl: plan.portalsToCrawl,
        portalsSkipped: plan.portalsSkipped,
        confidence: plan.confidence,
      },
      evidence: { plan: plan.evidence },
    });

    if (!plan.shouldCrawl) {
      await updateJob(job.id, {
        status: 'completed',
        phase: 'done',
        finishedAt: new Date().toISOString(),
        stats: {
          knownBefore: plan.knownPropertyCount,
          fetched: 0,
          newListings: 0,
          changedListings: 0,
          removedListings: 0,
          alertsCreated: 0,
          kgChanges: 0,
          portalsCrawled: 0,
          portalsSkipped: plan.portalsSkipped.length,
          durationMs: Date.now() - started,
        },
      });
      await updateWatch(watch.id, {
        lastRunAt: new Date().toISOString(),
        lastJobId: job.id,
        health: 'healthy',
        nextRunAt: computeNextRunAt(watch.frequency, new Date(), seedFromId(watch.id)),
      });
      return getJobById(job.id);
    }

    await setJobPhase(job.id, 'delta_compare');
    const baseline = await buildDeltaBaseline(watch);
    const knownBefore = baseline.knownProperties.length;

    await setJobPhase(job.id, 'browser_crawl');
    await recordWorkerHeartbeat({
      workerId: WORKER_ID,
      workerType: 'browser_crawl',
      status: 'busy',
      workspaceId: watch.workspaceId,
      metrics: { portals: plan.portalsToCrawl },
    });

    const { listings, outcomes } = await searchPortalsInParallel({
      workspaceId: watch.workspaceId,
      criteria: baseline.criteria,
      portals: plan.portalsToCrawl,
    });

    const classified = listings.map((l) => ({
      listing: l,
      delta: classifyListingDelta(l, baseline),
    }));
    const incremental = classified
      .filter((c) => c.delta === 'new' || c.delta === 'changed')
      .map((c) => c.listing);
    const unchanged = classified.filter((c) => c.delta === 'unchanged').length;
    const toProcess = incremental.length ? incremental : listings.slice(0, 20);

    const { unique } = dedupeAcrossPortals(toProcess);
    const scored = scoreListings(unique, baseline.criteria, baseline.criteria.exclusions || []);

    await setJobPhase(job.id, 'knowledge_update');
    await recordWorkerHeartbeat({
      workerId: WORKER_ID,
      workerType: 'knowledge_update',
      status: 'busy',
      workspaceId: watch.workspaceId,
    });
    const enrichment = await enrichKnowledgeGraph({
      workspaceId: watch.workspaceId,
      researchSessionId: `watch:${watch.id}`,
      runId: job.id,
      listings: scored,
    });

    await setJobPhase(job.id, 'change_detect');
    const db = await getResearchDatabase();
    const since = job.startedAt || job.createdAt;
    const changes = await db
      .collection<KgChange>(RESEARCH_COLLECTIONS.kgChanges)
      .find({
        workspaceId: watch.workspaceId,
        detectedAt: { $gte: since },
      })
      .limit(200)
      .toArray();

    const propertyIds = Array.from(new Set(changes.map((c) => c.propertyId)));
    const props = propertyIds.length
      ? await db
          .collection<KgProperty>(RESEARCH_COLLECTIONS.kgProperties)
          .find({ workspaceId: watch.workspaceId, id: { $in: propertyIds } })
          .toArray()
      : [];
    const propertiesById = new Map(props.map((p) => [p.id, p]));

    const seenFps = new Set(scored.map((l) => l.duplicateGroupId).filter(Boolean));
    const removedCount =
      listings.length > 0
        ? baseline.knownProperties.filter(
            (p) => p.status === 'active' && !seenFps.has(p.identity.fingerprint),
          ).length
        : 0;

    const knownAfter = knownBefore + enrichment.propertiesUpserted;
    const newListings = classified.filter((c) => c.delta === 'new').length;
    const changedListings = classified.filter((c) => c.delta === 'changed').length;

    await setJobPhase(job.id, 'alert_generate');
    await recordWorkerHeartbeat({
      workerId: WORKER_ID,
      workerType: 'alert_generate',
      status: 'busy',
      workspaceId: watch.workspaceId,
    });
    const alertsCreated = await generateAlertsFromChanges({
      watch,
      jobId: job.id,
      changes,
      propertiesById,
      newCount: newListings,
      removedCount: Math.min(removedCount, 50),
      knownBefore,
      knownAfter,
    });

    await setJobPhase(job.id, 'trend_update');
    await recordWorkerHeartbeat({
      workerId: WORKER_ID,
      workerType: 'trend_update',
      status: 'busy',
      workspaceId: watch.workspaceId,
    });
    const trends = await computeWorkspaceTrends(watch.workspaceId, 30);

    await setJobPhase(job.id, 'notify');
    await recordWorkerHeartbeat({
      workerId: WORKER_ID,
      workerType: 'notification',
      status: 'busy',
      workspaceId: watch.workspaceId,
    });
    await publishInsightNotifications({
      workspaceId: watch.workspaceId,
      watchId: watch.id,
      jobId: job.id,
      trends,
    });

    const stats = {
      knownBefore,
      fetched: listings.length,
      newListings,
      changedListings,
      removedListings: Math.min(removedCount, 50),
      alertsCreated,
      kgChanges: enrichment.changesDetected,
      portalsCrawled: plan.portalsToCrawl.length,
      portalsSkipped: plan.portalsSkipped.length,
      durationMs: Date.now() - started,
    };

    await updateJob(job.id, {
      status: 'completed',
      phase: 'done',
      finishedAt: new Date().toISOString(),
      stats,
      evidence: {
        plan: plan.evidence,
        portalOutcomes: outcomes.map((o) => ({
          portal: o.portal,
          ok: o.ok,
          message: o.message,
        })),
        unchangedSkipped: unchanged,
        criteria: baseline.criteria,
      },
    });

    const prev = watch.statistics || {
      totalRuns: 0,
      successfulRuns: 0,
      failedRuns: 0,
      totalNewListings: 0,
      totalChangedListings: 0,
      totalRemovedListings: 0,
      totalAlerts: 0,
      lastFetched: 0,
      avgDurationMs: null,
    };
    const totalRuns = prev.totalRuns + 1;
    const successfulRuns = prev.successfulRuns + 1;
    const statistics = {
      ...prev,
      totalRuns,
      successfulRuns,
      totalNewListings: prev.totalNewListings + newListings,
      totalChangedListings: prev.totalChangedListings + changedListings,
      totalRemovedListings: prev.totalRemovedListings + Math.min(removedCount, 50),
      totalAlerts: prev.totalAlerts + alertsCreated,
      lastFetched: listings.length,
      avgDurationMs: Math.round(
        ((prev.avgDurationMs || 0) * prev.totalRuns + (Date.now() - started)) / totalRuns,
      ),
    };

    const changeDetected = newListings + changedListings + enrichment.changesDetected > 0;
    await updateWatch(watch.id, {
      lastRunAt: new Date().toISOString(),
      lastJobId: job.id,
      lastError: undefined,
      runCount: watch.runCount + 1,
      status: 'active',
      enabled: true,
      statistics,
      health: deriveWatchHealth(statistics),
      lastChangeDetectedAt: changeDetected
        ? new Date().toISOString()
        : watch.lastChangeDetectedAt,
      nextRunAt: computeNextRunAt(watch.frequency, new Date(), seedFromId(watch.id)),
    });

    await audit({
      workspaceId: watch.workspaceId,
      action: 'watch_job_completed',
      watchId: watch.id,
      jobId: job.id,
      details: stats,
    });

    await recordWorkerHeartbeat({
      workerId: WORKER_ID,
      workerType: 'browser_crawl',
      status: 'idle',
      workspaceId: watch.workspaceId,
      metrics: stats,
    });

    return getJobById(job.id);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const shouldRetry = job.attempt < job.maxAttempts;
    await updateJob(job.id, {
      status: shouldRetry ? 'retrying' : 'failed',
      phase: 'done',
      errorMessage: message,
      finishedAt: shouldRetry ? undefined : new Date().toISOString(),
      evidence: { retry: shouldRetry, attempt: job.attempt },
    });
    if (shouldRetry) {
      const db = await getResearchDatabase();
      const delayMs = Math.min(120_000, 5_000 * Math.max(1, job.attempt));
      await db.collection(RESEARCH_COLLECTIONS.watchJobs).updateOne(
        { id: job.id },
        {
          $set: {
            scheduledFor: new Date(Date.now() + delayMs).toISOString(),
            workerType: 'retry',
            updatedAt: new Date().toISOString(),
          },
        },
      );
      await recordWorkerHeartbeat({
        workerId: WORKER_ID,
        workerType: 'retry',
        status: 'idle',
        metrics: { jobId: job.id, delayMs },
      });
    }
    const prev = watch.statistics || {
      totalRuns: 0,
      successfulRuns: 0,
      failedRuns: 0,
      totalNewListings: 0,
      totalChangedListings: 0,
      totalRemovedListings: 0,
      totalAlerts: 0,
      lastFetched: 0,
      avgDurationMs: null,
    };
    const statistics = {
      ...prev,
      totalRuns: prev.totalRuns + 1,
      failedRuns: prev.failedRuns + 1,
    };
    await updateWatch(watch.id, {
      lastError: message,
      status: shouldRetry ? 'active' : 'error',
      lastJobId: job.id,
      statistics,
      health: deriveWatchHealth(statistics, message),
    });
    await audit({
      workspaceId: watch.workspaceId,
      action: 'watch_job_failed',
      watchId: watch.id,
      jobId: job.id,
      details: { message, attempt: job.attempt, retry: shouldRetry },
    });
    await recordWorkerHeartbeat({
      workerId: WORKER_ID,
      workerType: 'browser_crawl',
      status: 'error',
      workspaceId: watch.workspaceId,
      metrics: { error: message },
    });
    return getJobById(job.id);
  }
}

/** Scheduler + worker tick used by isolated background script / cron. */
export async function runMonitorTick(opts?: {
  enqueueLimit?: number;
  processLimit?: number;
}): Promise<{
  enqueued: number;
  processed: number;
  jobs: Array<{ id: string; status: string; watchId: string }>;
}> {
  const { enqueued } = await scheduleDueWatches(opts?.enqueueLimit || 20);
  const processedJobs: WatchJob[] = [];
  const limit = opts?.processLimit || 3;
  for (let i = 0; i < limit; i += 1) {
    const job = await processNextWatchJob();
    if (!job) break;
    processedJobs.push(job);
  }
  await recordWorkerHeartbeat({
    workerId: WORKER_ID,
    workerType: 'health',
    status: 'idle',
    metrics: { enqueued, processed: processedJobs.length },
  });
  return {
    enqueued,
    processed: processedJobs.length,
    jobs: processedJobs.map((j) => ({
      id: j.id,
      status: j.status,
      watchId: j.watchId,
    })),
  };
}

export async function runWatchNow(watch: ResearchWatch): Promise<WatchJob> {
  const job = await enqueueWatchJob({
    workspaceId: watch.workspaceId,
    watchId: watch.id,
    priority: watch.priority === 'low' ? 'high' : watch.priority,
  });
  const claimed = await processNextWatchJob();
  return claimed || job;
}
