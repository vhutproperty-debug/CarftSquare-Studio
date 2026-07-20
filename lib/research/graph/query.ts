import { RESEARCH_COLLECTIONS } from '@/lib/research/collections';
import { ensureKnowledgeGraphIndexes } from '@/lib/research/graph/indexes';
import { slug } from '@/lib/research/graph/identity';
import type {
  KgChange,
  KgDashboardStats,
  KgEdge,
  KgObservation,
  KgProperty,
  KgTimelineEvent,
} from '@/lib/research/graph/types';
import { ensureResearchIndexes, getResearchDatabase } from '@/lib/research/store';
import type { ResearchPlanCriteria, ResearchScoredListing } from '@/lib/research/types';

let dashboardCache: { key: string; at: number; value: KgDashboardStats } | null = null;

export async function queryKnownProperties(
  workspaceId: string,
  criteria: ResearchPlanCriteria,
  limit = 40,
): Promise<KgProperty[]> {
  const db = await getResearchDatabase();
  await ensureResearchIndexes(db);
  await ensureKnowledgeGraphIndexes(db);

  const filter: Record<string, unknown> = {
    workspaceId,
    status: 'active',
  };
  if (criteria.bhk != null) filter.bhk = criteria.bhk;
  if (criteria.project) {
    filter.projectName = { $regex: criteria.project.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
  }
  if (criteria.projects?.length) {
    filter.$or = criteria.projects.map((p) => ({
      projectName: { $regex: p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' },
    }));
  }
  if (criteria.locality) {
    // locality stored via localityId mostly; also soft match project/title
    filter.$or = [
      ...(Array.isArray(filter.$or) ? filter.$or : []),
      { title: { $regex: criteria.locality, $options: 'i' } },
    ];
  }
  if (criteria.maxBudget != null) {
    filter.$and = [
      {
        $or: [
          { rent: { $lte: criteria.maxBudget } },
          { rent: { $exists: false } },
          { salePrice: { $lte: criteria.maxBudget } },
        ],
      },
    ];
  }

  return db
    .collection<KgProperty>(RESEARCH_COLLECTIONS.kgProperties)
    .find(filter)
    .sort({ lastSeenAt: -1 })
    .limit(limit)
    .toArray();
}

/** Convert KG properties into scored-listing shape for AI reuse. */
export function kgPropertiesToListings(properties: KgProperty[]): ResearchScoredListing[] {
  return properties.map((p) => ({
    id: `kg:${p.id}`,
    portal: p.portalKeys[0] || 'knowledge-graph',
    title: p.title,
    projectName: p.projectName,
    configuration: p.configuration,
    bhk: p.bhk,
    rent: p.rent,
    salePrice: p.salePrice,
    furnishing: p.furnishing,
    url: p.portalUrls[0],
    facing: p.facing,
    tower: p.tower,
    unit: p.unit,
    carpetArea: p.carpetArea,
    broker: p.brokerHistory[p.brokerHistory.length - 1]?.brokerName,
    portalRefs: p.portalKeys.map((portal, i) => ({
      portal,
      url: p.portalUrls[i],
      listingId: `kg:${p.id}:${portal}`,
    })),
    relevanceScore: 0,
    scoreBreakdown: { knowledgeGraph: 10 },
    explanation: `Known from knowledge graph (first seen ${p.firstSeenAt.slice(0, 10)}, last seen ${p.lastSeenAt.slice(0, 10)}, ${p.observationCount} observation(s)).`,
    duplicateGroupId: p.identity.fingerprint,
    listingSource:
      p.listedBy === 'owner' ? ('owner' as const) : p.listedBy === 'broker' ? ('broker' as const) : ('unknown' as const),
    listedBy: p.listedBy || 'unknown',
  }));
}

export async function getPropertyTimeline(
  workspaceId: string,
  propertyId: string,
): Promise<KgTimelineEvent[]> {
  const db = await getResearchDatabase();
  await ensureResearchIndexes(db);
  await ensureKnowledgeGraphIndexes(db);
  return db
    .collection<KgTimelineEvent>(RESEARCH_COLLECTIONS.kgTimeline)
    .find({ workspaceId, propertyId })
    .sort({ at: -1 })
    .limit(200)
    .toArray();
}

export async function getPropertyObservations(
  workspaceId: string,
  propertyId: string,
): Promise<KgObservation[]> {
  const db = await getResearchDatabase();
  await ensureResearchIndexes(db);
  await ensureKnowledgeGraphIndexes(db);
  return db
    .collection<KgObservation>(RESEARCH_COLLECTIONS.kgObservations)
    .find({ workspaceId, propertyId })
    .sort({ observedAt: -1 })
    .limit(200)
    .toArray();
}

export async function getPropertyPriceHistory(workspaceId: string, propertyId: string) {
  const db = await getResearchDatabase();
  await ensureResearchIndexes(db);
  await ensureKnowledgeGraphIndexes(db);
  const property = await db
    .collection<KgProperty>(RESEARCH_COLLECTIONS.kgProperties)
    .findOne({ workspaceId, id: propertyId });
  return property?.priceHistory || [];
}

export async function getPropertyChanges(
  workspaceId: string,
  propertyId: string,
): Promise<KgChange[]> {
  const db = await getResearchDatabase();
  await ensureResearchIndexes(db);
  await ensureKnowledgeGraphIndexes(db);
  return db
    .collection<KgChange>(RESEARCH_COLLECTIONS.kgChanges)
    .find({ workspaceId, propertyId })
    .sort({ detectedAt: -1 })
    .limit(100)
    .toArray();
}

export async function getGraphRelationships(
  workspaceId: string,
  entityId: string,
): Promise<KgEdge[]> {
  const db = await getResearchDatabase();
  await ensureResearchIndexes(db);
  await ensureKnowledgeGraphIndexes(db);
  return db
    .collection<KgEdge>(RESEARCH_COLLECTIONS.kgEdges)
    .find({
      workspaceId,
      $or: [{ fromId: entityId }, { toId: entityId }],
    })
    .limit(200)
    .toArray();
}

export async function getKnowledgeDashboardStats(
  workspaceId: string,
): Promise<KgDashboardStats> {
  const cacheKey = workspaceId;
  if (dashboardCache && dashboardCache.key === cacheKey && Date.now() - dashboardCache.at < 15_000) {
    return dashboardCache.value;
  }

  const db = await getResearchDatabase();
  await ensureResearchIndexes(db);
  await ensureKnowledgeGraphIndexes(db);

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const [
    totalProperties,
    trackedProjects,
    trackedBrokers,
    historicalObservations,
    priceDropsDetected,
    newListings,
    removedListings,
    growth,
  ] = await Promise.all([
    db.collection(RESEARCH_COLLECTIONS.kgProperties).countDocuments({ workspaceId }),
    db.collection(RESEARCH_COLLECTIONS.kgProjects).countDocuments({ workspaceId }),
    db.collection(RESEARCH_COLLECTIONS.kgBrokers).countDocuments({ workspaceId }),
    db.collection(RESEARCH_COLLECTIONS.kgObservations).countDocuments({ workspaceId }),
    db.collection(RESEARCH_COLLECTIONS.kgChanges).countDocuments({
      workspaceId,
      type: 'price_dropped',
      detectedAt: { $gte: weekAgo },
    }),
    db.collection(RESEARCH_COLLECTIONS.kgProperties).countDocuments({
      workspaceId,
      firstSeenAt: { $gte: weekAgo },
    }),
    db.collection(RESEARCH_COLLECTIONS.kgProperties).countDocuments({
      workspaceId,
      status: 'removed',
      updatedAt: { $gte: weekAgo },
    }),
    db.collection(RESEARCH_COLLECTIONS.kgProperties).countDocuments({
      workspaceId,
      createdAt: { $gte: weekAgo },
    }),
  ]);

  // Average market movement from recent price changes (collected only)
  const recentPriceChanges = await db
    .collection<KgChange>(RESEARCH_COLLECTIONS.kgChanges)
    .find({
      workspaceId,
      type: { $in: ['price_dropped', 'price_increased'] },
      detectedAt: { $gte: weekAgo },
    })
    .limit(200)
    .toArray();

  let averageMarketMovementPct: number | null = null;
  const pcts: number[] = [];
  for (const c of recentPriceChanges) {
    const from = Number(c.fromValue);
    const to = Number(c.toValue);
    if (Number.isFinite(from) && from > 0 && Number.isFinite(to)) {
      pcts.push(((to - from) / from) * 100);
    }
  }
  if (pcts.length) {
    averageMarketMovementPct = Math.round((pcts.reduce((a, b) => a + b, 0) / pcts.length) * 10) / 10;
  }

  const value: KgDashboardStats = {
    totalProperties,
    trackedProjects,
    trackedBrokers,
    historicalObservations,
    priceDropsDetected,
    newListings,
    removedListings,
    averageMarketMovementPct,
    knowledgeGraphGrowth7d: growth,
  };
  dashboardCache = { key: cacheKey, at: Date.now(), value };
  return value;
}

export async function findProjectByName(workspaceId: string, name: string) {
  const db = await getResearchDatabase();
  await ensureResearchIndexes(db);
  await ensureKnowledgeGraphIndexes(db);
  return db.collection(RESEARCH_COLLECTIONS.kgProjects).findOne({
    workspaceId,
    nameKey: slug(name),
  });
}

export async function findBrokerByName(workspaceId: string, name: string) {
  const db = await getResearchDatabase();
  await ensureResearchIndexes(db);
  await ensureKnowledgeGraphIndexes(db);
  return db.collection(RESEARCH_COLLECTIONS.kgBrokers).findOne({
    workspaceId,
    nameKey: slug(name),
  });
}
