import { RESEARCH_COLLECTIONS } from '@/lib/research/collections';
import { RESEARCH_PORTALS } from '@/lib/research/browser/config';
import type { ResearchWatch, SmartCrawlPlan } from '@/lib/research/monitoring/types';
import { listPortalConnections } from '@/lib/research/store/portal-connections';
import { ensureResearchIndexes, getResearchDatabase } from '@/lib/research/store';

/**
 * Smart Research Planner — decide whether/which portals to crawl before browser work.
 * Consults Knowledge Graph, recent observations, prior jobs, and connector health.
 */
export async function planWatchCrawl(watch: ResearchWatch): Promise<SmartCrawlPlan> {
  const db = await getResearchDatabase();
  await ensureResearchIndexes(db);

  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const since6h = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();

  const [connections, knownCount, recentChanges, lastJob, recentObservations] = await Promise.all([
    listPortalConnections(watch.workspaceId),
    db.collection(RESEARCH_COLLECTIONS.kgProperties).countDocuments({
      workspaceId: watch.workspaceId,
      status: { $in: ['active', 'relisted', 'unknown'] },
    }),
    db.collection(RESEARCH_COLLECTIONS.kgChanges).countDocuments({
      workspaceId: watch.workspaceId,
      detectedAt: { $gte: since24h },
    }),
    db.collection(RESEARCH_COLLECTIONS.watchJobs).findOne(
      { watchId: watch.id, status: 'completed' },
      { sort: { finishedAt: -1 } },
    ),
    db.collection(RESEARCH_COLLECTIONS.kgObservations).countDocuments({
      workspaceId: watch.workspaceId,
      observedAt: { $gte: since6h },
    }),
  ]);

  const connectedKeys = new Set(
    connections.filter((c) => c.status === 'connected').map((c) => c.portalKey),
  );
  const strategy = watch.searchStrategy || {
    mode: 'adaptive' as const,
    skipUnchangedPortals: true,
    preferKnowledgeGraph: true,
  };

  const preferred =
    strategy.portals?.length
      ? strategy.portals
      : watch.filters.portals?.length
        ? watch.filters.portals
        : RESEARCH_PORTALS.map((p) => p.key);

  const portalsSkipped: Array<{ portal: string; reason: string }> = [];
  const portalsToCrawl: string[] = [];

  for (const portal of preferred) {
    if (!connectedKeys.has(portal)) {
      portalsSkipped.push({ portal, reason: 'connector_disconnected' });
      continue;
    }

    if (
      strategy.skipUnchangedPortals &&
      strategy.mode === 'adaptive' &&
      lastJob?.finishedAt &&
      lastJob.finishedAt > since6h &&
      (lastJob.stats?.kgChanges || 0) === 0 &&
      (lastJob.stats?.newListings || 0) === 0 &&
      recentChanges === 0
    ) {
      portalsSkipped.push({ portal, reason: 'no_recent_delta_signal' });
      continue;
    }

    portalsToCrawl.push(portal);
  }

  if (!portalsToCrawl.length && connectedKeys.size) {
    const fallback = Array.from(connectedKeys)[0]!;
    portalsToCrawl.push(fallback);
    const idx = portalsSkipped.findIndex((p) => p.portal === fallback);
    if (idx >= 0) portalsSkipped.splice(idx, 1);
  }

  const shouldCrawl =
    portalsToCrawl.length > 0 && watch.enabled !== false && watch.status === 'active';

  let reason = 'scheduled_delta_refresh';
  if (!shouldCrawl) reason = 'no_healthy_connectors';
  else if (recentChanges > 0) reason = 'recent_kg_changes_detected';
  else if (knownCount === 0) reason = 'cold_start_seed_knowledge_graph';
  else if (strategy.mode === 'full_refresh') reason = 'full_refresh_requested';
  else if (watch.frequency === 'event') reason = 'event_triggered';

  const confidence = Math.min(
    100,
    40
      + (connectedKeys.size ? 20 : 0)
      + (knownCount > 0 ? 15 : 0)
      + (recentObservations > 0 ? 10 : 0)
      + (portalsToCrawl.length ? 15 : 0),
  );

  return {
    shouldCrawl,
    reason,
    portalsToCrawl,
    portalsSkipped,
    strategy: {
      ...strategy,
      portals: portalsToCrawl,
    },
    knownPropertyCount: knownCount,
    recentChangeCount: recentChanges,
    confidence,
    evidence: {
      connectedPortals: Array.from(connectedKeys),
      lastJobId: lastJob?.id,
      lastJobFinishedAt: lastJob?.finishedAt,
      recentObservations6h: recentObservations,
      watchScope: watch.scope,
      preferKnowledgeGraph: strategy.preferKnowledgeGraph !== false,
    },
  };
}
