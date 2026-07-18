import { v4 as uuidv4 } from 'uuid';
import { RESEARCH_COLLECTIONS } from '@/lib/research/collections';
import { ensureMonitoringIndexes } from '@/lib/research/monitoring/indexes';
import type { TrendSnapshot } from '@/lib/research/monitoring/types';
import type {
  KgBroker,
  KgBuilder,
  KgChange,
  KgLocality,
  KgObservation,
  KgProject,
  KgProperty,
} from '@/lib/research/graph/types';
import { ensureResearchIndexes, getResearchDatabase } from '@/lib/research/store';

async function dbReady() {
  const db = await getResearchDatabase();
  await ensureResearchIndexes(db);
  await ensureMonitoringIndexes(db);
  return db;
}

function avg(nums: number[]): number | null {
  if (!nums.length) return null;
  return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length);
}

function volatilityFromChanges(changes: KgChange[]): number | null {
  const pcts: number[] = [];
  for (const c of changes) {
    if (c.type !== 'price_dropped' && c.type !== 'price_increased') continue;
    const from = Number(c.fromValue);
    const to = Number(c.toValue);
    if (Number.isFinite(from) && from > 0 && Number.isFinite(to)) {
      pcts.push(((to - from) / from) * 100);
    }
  }
  if (!pcts.length) return null;
  return Math.round(Math.sqrt(pcts.reduce((s, x) => s + x * x, 0) / pcts.length) * 10) / 10;
}

function priceVelocity(changes: KgChange[], windowDays: number): number | null {
  const moves = changes.filter(
    (c) => c.type === 'price_dropped' || c.type === 'price_increased',
  );
  if (!moves.length) return null;
  return Math.round((moves.length / Math.max(1, windowDays)) * 10) / 10;
}

async function buildEntityTrend(input: {
  workspaceId: string;
  entityType: TrendSnapshot['entityType'];
  entityId: string;
  entityLabel: string;
  propertyIds: string[];
  windowDays: number;
  since: string;
  now: string;
  inventoryDeltaPct?: number | null;
}): Promise<TrendSnapshot> {
  const db = await dbReady();
  const { propertyIds, workspaceId, since } = input;

  const [rents, sales, changes, props] = await Promise.all([
    db
      .collection<KgObservation>(RESEARCH_COLLECTIONS.kgObservations)
      .find({
        workspaceId,
        propertyId: { $in: propertyIds },
        observedAt: { $gte: since },
        rent: { $type: 'number' },
      })
      .project({ rent: 1, observedAt: 1 })
      .sort({ observedAt: 1 })
      .toArray(),
    db
      .collection<KgObservation>(RESEARCH_COLLECTIONS.kgObservations)
      .find({
        workspaceId,
        propertyId: { $in: propertyIds },
        observedAt: { $gte: since },
        salePrice: { $type: 'number' },
      })
      .project({ salePrice: 1, observedAt: 1 })
      .sort({ observedAt: 1 })
      .toArray(),
    db
      .collection<KgChange>(RESEARCH_COLLECTIONS.kgChanges)
      .find({
        workspaceId,
        propertyId: { $in: propertyIds },
        detectedAt: { $gte: since },
      })
      .toArray(),
    db
      .collection<KgProperty>(RESEARCH_COLLECTIONS.kgProperties)
      .find({ workspaceId, id: { $in: propertyIds } })
      .project({ brokerId: 1, portalKeys: 1, daysOnMarket: 1, lastSeenAt: 1 })
      .toArray(),
  ]);

  const earlyR = rents.slice(0, Math.max(1, Math.floor(rents.length / 3)));
  const lateR = rents.slice(Math.max(0, rents.length - Math.max(1, Math.floor(rents.length / 3))));
  const earlyAvg = avg(earlyR.map((r) => r.rent!).filter((n) => n != null));
  const lateAvg = avg(lateR.map((r) => r.rent!).filter((n) => n != null));
  const averageRentDelta =
    earlyAvg != null && lateAvg != null ? lateAvg - earlyAvg : null;

  const earlyS = sales.slice(0, Math.max(1, Math.floor(sales.length / 3)));
  const lateS = sales.slice(Math.max(0, sales.length - Math.max(1, Math.floor(sales.length / 3))));
  const earlySale = avg(earlyS.map((r) => r.salePrice!).filter((n) => n != null));
  const lateSale = avg(lateS.map((r) => r.salePrice!).filter((n) => n != null));
  const averageSaleDelta =
    earlySale != null && lateSale != null ? lateSale - earlySale : null;

  const brokerActivity = new Set(props.map((p) => p.brokerId).filter(Boolean)).size;
  const portalDistribution: Record<string, number> = {};
  for (const p of props) {
    for (const key of p.portalKeys || []) {
      portalDistribution[key] = (portalDistribution[key] || 0) + 1;
    }
  }
  const freshness = avg(props.map((p) => p.daysOnMarket).filter((n) => typeof n === 'number'));
  const priceVolatility = volatilityFromChanges(changes);
  const velocity = priceVelocity(changes, input.windowDays);
  const inventoryDeltaPct = input.inventoryDeltaPct ?? null;

  const momentumScore = Math.max(
    0,
    Math.min(
      100,
      50
        + (inventoryDeltaPct || 0)
        + (averageRentDelta != null ? Math.sign(averageRentDelta) * 5 : 0)
        + Math.min(20, brokerActivity * 2)
        + Math.min(10, changes.length),
    ),
  );

  return {
    id: uuidv4(),
    workspaceId,
    entityType: input.entityType,
    entityId: input.entityId,
    entityLabel: input.entityLabel,
    inventoryDeltaPct,
    averageRentDelta,
    averageSaleDelta,
    priceVelocity: velocity,
    brokerActivity,
    marketActivity: changes.length,
    listingFreshnessDays: freshness,
    portalDistribution,
    priceVolatility,
    momentumScore,
    windowDays: input.windowDays,
    sampleSize: rents.length + sales.length,
    evidence: {
      observationSample: rents.length + sales.length,
      changeCount: changes.length,
      propertyCount: propertyIds.length,
      rentalSample: rents.length,
      saleSample: sales.length,
    },
    computedAt: input.now,
    createdAt: input.now,
  };
}

/**
 * Compute evidence-based trends from historical observations/changes only.
 * Covers project, locality, broker, builder, and city aggregates.
 */
export async function computeWorkspaceTrends(
  workspaceId: string,
  windowDays = 30,
): Promise<TrendSnapshot[]> {
  const db = await dbReady();
  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000).toISOString();
  const now = new Date().toISOString();
  const snapshots: TrendSnapshot[] = [];

  const projects = await db
    .collection<KgProject>(RESEARCH_COLLECTIONS.kgProjects)
    .find({ workspaceId })
    .limit(40)
    .toArray();

  for (const project of projects) {
    const propertyIds = (
      await db
        .collection(RESEARCH_COLLECTIONS.kgProperties)
        .find({ workspaceId, projectId: project.id })
        .project({ id: 1 })
        .limit(300)
        .toArray()
    ).map((p) => p.id as string);
    if (!propertyIds.length) continue;
    const snap = await buildEntityTrend({
      workspaceId,
      entityType: 'project',
      entityId: project.id,
      entityLabel: project.name,
      propertyIds,
      windowDays,
      since,
      now,
      inventoryDeltaPct: project.inventoryGrowthPct ?? null,
    });
    snapshots.push(snap);
    await db.collection(RESEARCH_COLLECTIONS.trends).insertOne(snap);
  }

  const localities = await db
    .collection<KgLocality>(RESEARCH_COLLECTIONS.kgLocalities)
    .find({ workspaceId })
    .limit(20)
    .toArray();
  for (const loc of localities) {
    const propertyIds = (
      await db
        .collection(RESEARCH_COLLECTIONS.kgProperties)
        .find({ workspaceId, localityId: loc.id })
        .project({ id: 1 })
        .limit(300)
        .toArray()
    ).map((p) => p.id as string);
    if (!propertyIds.length) continue;
    const snap = await buildEntityTrend({
      workspaceId,
      entityType: 'locality',
      entityId: loc.id,
      entityLabel: loc.name,
      propertyIds,
      windowDays,
      since,
      now,
    });
    snapshots.push(snap);
    await db.collection(RESEARCH_COLLECTIONS.trends).insertOne(snap);
  }

  const brokers = await db
    .collection<KgBroker>(RESEARCH_COLLECTIONS.kgBrokers)
    .find({ workspaceId })
    .limit(20)
    .toArray();
  for (const broker of brokers) {
    const propertyIds = (
      await db
        .collection(RESEARCH_COLLECTIONS.kgProperties)
        .find({ workspaceId, brokerId: broker.id })
        .project({ id: 1 })
        .limit(300)
        .toArray()
    ).map((p) => p.id as string);
    if (!propertyIds.length) continue;
    const snap = await buildEntityTrend({
      workspaceId,
      entityType: 'broker',
      entityId: broker.id,
      entityLabel: broker.name,
      propertyIds,
      windowDays,
      since,
      now,
    });
    snapshots.push(snap);
    await db.collection(RESEARCH_COLLECTIONS.trends).insertOne(snap);
  }

  const builders = await db
    .collection<KgBuilder>(RESEARCH_COLLECTIONS.kgBuilders)
    .find({ workspaceId })
    .limit(15)
    .toArray();
  for (const builder of builders) {
    const projectIds = (
      await db
        .collection(RESEARCH_COLLECTIONS.kgProjects)
        .find({ workspaceId, builderId: builder.id })
        .project({ id: 1 })
        .toArray()
    ).map((p) => p.id as string);
    const propertyIds = projectIds.length
      ? (
          await db
            .collection(RESEARCH_COLLECTIONS.kgProperties)
            .find({ workspaceId, projectId: { $in: projectIds } })
            .project({ id: 1 })
            .limit(300)
            .toArray()
        ).map((p) => p.id as string)
      : [];
    if (!propertyIds.length) continue;
    const snap = await buildEntityTrend({
      workspaceId,
      entityType: 'builder',
      entityId: builder.id,
      entityLabel: builder.name,
      propertyIds,
      windowDays,
      since,
      now,
    });
    snapshots.push(snap);
    await db.collection(RESEARCH_COLLECTIONS.trends).insertOne(snap);
  }

  // City aggregate from property city field / Mumbai default workspace activity
  const cityProps = await db
    .collection<KgProperty>(RESEARCH_COLLECTIONS.kgProperties)
    .find({ workspaceId })
    .project({ id: 1, city: 1 })
    .limit(500)
    .toArray();
  const byCity = new Map<string, string[]>();
  for (const p of cityProps) {
    const city = (p as { city?: string }).city || 'Mumbai';
    const list = byCity.get(city) || [];
    list.push(p.id);
    byCity.set(city, list);
  }
  for (const [city, propertyIds] of byCity) {
    const snap = await buildEntityTrend({
      workspaceId,
      entityType: 'city',
      entityId: `city:${city.toLowerCase()}`,
      entityLabel: city,
      propertyIds: propertyIds.slice(0, 300),
      windowDays,
      since,
      now,
    });
    snapshots.push(snap);
    await db.collection(RESEARCH_COLLECTIONS.trends).insertOne(snap);
  }

  return snapshots;
}

export async function listTrends(
  workspaceId: string,
  limit = 30,
): Promise<TrendSnapshot[]> {
  const db = await dbReady();
  return db
    .collection<TrendSnapshot>(RESEARCH_COLLECTIONS.trends)
    .find({ workspaceId })
    .sort({ computedAt: -1 })
    .limit(limit)
    .toArray();
}
