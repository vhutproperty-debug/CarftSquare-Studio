import { RESEARCH_COLLECTIONS } from '@/lib/research/collections';
import type { KgChange, KgProject, KgProperty } from '@/lib/research/graph/types';
import { ensureKnowledgeGraphIndexes } from '@/lib/research/graph/indexes';
import { ensureResearchIndexes, getResearchDatabase } from '@/lib/research/store';

export async function recomputeProjectStats(workspaceId: string, projectId: string): Promise<void> {
  const db = await getResearchDatabase();
  await ensureResearchIndexes(db);
  await ensureKnowledgeGraphIndexes(db);

  const properties = await db
    .collection<KgProperty>(RESEARCH_COLLECTIONS.kgProperties)
    .find({ workspaceId, projectId })
    .toArray();

  const active = properties.filter((p) => p.status === 'active');
  const rents = active.map((p) => p.rent).filter((n): n is number => n != null);
  const sales = active.map((p) => p.salePrice).filter((n): n is number => n != null);
  const portalDistribution: Record<string, number> = {};
  for (const p of active) {
    for (const portal of p.portalKeys) {
      portalDistribution[portal] = (portalDistribution[portal] || 0) + 1;
    }
  }

  const brokerCounts = new Map<string, number>();
  for (const p of active) {
    if (!p.brokerId) continue;
    brokerCounts.set(p.brokerId, (brokerCounts.get(p.brokerId) || 0) + 1);
  }
  const topBrokerIds = [...brokerCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id]) => id);

  const weekAgoIso = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const newListings7d = properties.filter(
    (p) => new Date(p.firstSeenAt).getTime() >= weekAgo,
  ).length;
  const removedListings7d = properties.filter(
    (p) => p.status === 'removed' && new Date(p.updatedAt).getTime() >= weekAgo,
  ).length;

  const propertyIds = properties.map((p) => p.id);
  const [priceReductions7d, availabilityChanges7d] = await Promise.all([
    db.collection<KgChange>(RESEARCH_COLLECTIONS.kgChanges).countDocuments({
      workspaceId,
      propertyId: { $in: propertyIds },
      type: 'price_dropped',
      detectedAt: { $gte: weekAgoIso },
    }),
    db.collection<KgChange>(RESEARCH_COLLECTIONS.kgChanges).countDocuments({
      workspaceId,
      propertyId: { $in: propertyIds },
      type: 'availability_changed',
      detectedAt: { $gte: weekAgoIso },
    }),
  ]);

  const now = new Date().toISOString();
  const existing = await db.collection<KgProject>(RESEARCH_COLLECTIONS.kgProjects).findOne({
    id: projectId,
  });
  const inventoryTrend = [
    ...(existing?.inventoryTrend || []),
    { at: now, active: active.length },
  ].slice(-60);
  const priceTrend = [
    ...(existing?.priceTrend || []),
    {
      at: now,
      averageRent: rents.length
        ? Math.round(rents.reduce((a, b) => a + b, 0) / rents.length)
        : undefined,
      averageSalePrice: sales.length
        ? Math.round(sales.reduce((a, b) => a + b, 0) / sales.length)
        : undefined,
    },
  ].slice(-60);

  let inventoryGrowthPct: number | null = null;
  if (inventoryTrend.length >= 2) {
    const prev = inventoryTrend[inventoryTrend.length - 2]!.active;
    const curr = inventoryTrend[inventoryTrend.length - 1]!.active;
    if (prev > 0) inventoryGrowthPct = Math.round(((curr - prev) / prev) * 1000) / 10;
    else if (curr > 0) inventoryGrowthPct = 100;
  }

  await db.collection(RESEARCH_COLLECTIONS.kgProjects).updateOne(
    { id: projectId },
    {
      $set: {
        propertyCount: properties.length,
        rentalInventory: active.filter((p) => p.rent != null).length,
        saleInventory: active.filter((p) => p.salePrice != null).length,
        averageRent: rents.length
          ? Math.round(rents.reduce((a, b) => a + b, 0) / rents.length)
          : undefined,
        averageSalePrice: sales.length
          ? Math.round(sales.reduce((a, b) => a + b, 0) / sales.length)
          : undefined,
        portalDistribution,
        topBrokerIds,
        newListings7d,
        removedListings7d,
        priceReductions7d,
        availabilityChanges7d,
        inventoryGrowthPct,
        inventoryTrend,
        priceTrend,
        lastSeenAt: now,
        updatedAt: now,
      },
    },
  );
}
