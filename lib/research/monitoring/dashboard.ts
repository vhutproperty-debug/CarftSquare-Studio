import { RESEARCH_COLLECTIONS } from '@/lib/research/collections';
import { RESEARCH_PORTALS } from '@/lib/research/browser/config';
import { getKnowledgeDashboardStats } from '@/lib/research/graph/query';
import { buildProactiveInsights } from '@/lib/research/monitoring/insights';
import { ensureMonitoringIndexes } from '@/lib/research/monitoring/indexes';
import { countJobsByStatus } from '@/lib/research/monitoring/job-queue';
import { listTrends } from '@/lib/research/monitoring/trend-engine';
import type { MarketWatchDashboard, WatchJobWorkerType } from '@/lib/research/monitoring/types';
import { getSystemHealthReport, listWorkerHeartbeats } from '@/lib/research/monitoring/worker-health';
import { listPortalConnections } from '@/lib/research/store/portal-connections';
import { ensureResearchIndexes, getResearchDatabase } from '@/lib/research/store';

const WORKER_TYPES: WatchJobWorkerType[] = [
  'scheduler',
  'browser_crawl',
  'knowledge_update',
  'alert_generate',
  'trend_update',
  'notification',
  'retry',
  'health',
];

export async function getMarketWatchDashboard(
  workspaceId: string,
): Promise<MarketWatchDashboard> {
  const db = await getResearchDatabase();
  await ensureResearchIndexes(db);
  await ensureMonitoringIndexes(db);

  const today = new Date().toISOString().slice(0, 10);
  const [
    activeWatches,
    jobCounts,
    alertsToday,
    priceDrops,
    newListings,
    removedListings,
    inventoryChanges,
    kgStats,
    connections,
    trends,
    health,
    heartbeats,
  ] = await Promise.all([
    db.collection(RESEARCH_COLLECTIONS.watches).countDocuments({
      workspaceId,
      status: 'active',
    }),
    countJobsByStatus(workspaceId),
    db.collection(RESEARCH_COLLECTIONS.notifications).countDocuments({
      workspaceId,
      createdAt: { $gte: `${today}T00:00:00.000Z` },
      archived: { $ne: true },
    }),
    db.collection(RESEARCH_COLLECTIONS.notifications).countDocuments({
      workspaceId,
      category: 'price_drop',
      createdAt: { $gte: `${today}T00:00:00.000Z` },
    }),
    db.collection(RESEARCH_COLLECTIONS.notifications).countDocuments({
      workspaceId,
      category: 'new_listing',
      createdAt: { $gte: `${today}T00:00:00.000Z` },
    }),
    db.collection(RESEARCH_COLLECTIONS.notifications).countDocuments({
      workspaceId,
      category: 'listing_removed',
      createdAt: { $gte: `${today}T00:00:00.000Z` },
    }),
    db.collection(RESEARCH_COLLECTIONS.notifications).countDocuments({
      workspaceId,
      category: { $in: ['inventory_up', 'inventory_down'] },
      createdAt: { $gte: `${today}T00:00:00.000Z` },
    }),
    getKnowledgeDashboardStats(workspaceId),
    listPortalConnections(workspaceId),
    listTrends(workspaceId, 10),
    getSystemHealthReport(workspaceId),
    listWorkerHeartbeats(),
  ]);

  const byPortal = new Map(connections.map((c) => [c.portalKey, c.status]));
  const connectorHealth = RESEARCH_PORTALS.map((p) => ({
    portal: p.key,
    status: byPortal.get(p.key) || 'disconnected',
    latencyMs: health.avgConnectorLatencyMs,
  }));

  const scheduledJobs = await db.collection(RESEARCH_COLLECTIONS.watchJobs).countDocuments({
    workspaceId,
    status: { $in: ['queued', 'retrying'] },
  });

  const staleMs = 3 * 60 * 1000;
  const backgroundWorkers = WORKER_TYPES.map((workerType) => {
    const hb = heartbeats.find((h) => h.workerType === workerType);
    if (!hb) return { workerType, status: 'offline' as const };
    const age = Date.now() - new Date(hb.lastHeartbeatAt).getTime();
    return {
      workerType,
      status: (age <= staleMs ? 'online' : age <= staleMs * 5 ? 'stale' : 'offline') as
        | 'online'
        | 'stale'
        | 'offline',
      lastHeartbeatAt: hb.lastHeartbeatAt,
    };
  });

  return {
    activeWatches,
    scheduledJobs,
    jobsRunning: jobCounts.running || 0,
    jobsQueued: jobCounts.queued || 0,
    jobsCompleted: jobCounts.completed || 0,
    jobsFailed: jobCounts.failed || 0,
    alertsToday,
    priceDrops,
    newListings,
    removedListings,
    inventoryChanges,
    marketMovementPct: kgStats.averageMarketMovementPct ?? null,
    knowledgeGraphGrowth: kgStats.knowledgeGraphGrowth7d,
    connectorHealth,
    researchQueueDepth: scheduledJobs + (jobCounts.running || 0),
    systemHealth: health.status,
    backgroundWorkers,
    recentInsights: buildProactiveInsights(trends),
  };
}
