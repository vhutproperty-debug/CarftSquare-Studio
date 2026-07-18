import { RESEARCH_COLLECTIONS } from '@/lib/research/collections';
import type { KgLocality, KgProperty } from '@/lib/research/graph/types';
import { ensureKnowledgeGraphIndexes } from '@/lib/research/graph/indexes';
import { ensureResearchIndexes, getResearchDatabase } from '@/lib/research/store';

export async function recomputeLocalityStats(
  workspaceId: string,
  localityId: string,
): Promise<void> {
  const db = await getResearchDatabase();
  await ensureResearchIndexes(db);
  await ensureKnowledgeGraphIndexes(db);

  const properties = await db
    .collection<KgProperty>(RESEARCH_COLLECTIONS.kgProperties)
    .find({ workspaceId, localityId })
    .toArray();
  const active = properties.filter((p) => p.status === 'active');
  const rents = active.map((p) => p.rent).filter((n): n is number => n != null);
  const sales = active.map((p) => p.salePrice).filter((n): n is number => n != null);

  const popularConfigurations: Record<string, number> = {};
  const brokerConcentration: Record<string, number> = {};
  for (const p of active) {
    const cfg = p.configuration || (p.bhk != null ? `${p.bhk} BHK` : 'Unknown');
    popularConfigurations[cfg] = (popularConfigurations[cfg] || 0) + 1;
    if (p.brokerId) {
      brokerConcentration[p.brokerId] = (brokerConcentration[p.brokerId] || 0) + 1;
    }
  }

  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const marketActivity7d = properties.filter(
    (p) => new Date(p.lastSeenAt).getTime() >= weekAgo,
  ).length;

  const now = new Date().toISOString();
  const existing = await db.collection<KgLocality>(RESEARCH_COLLECTIONS.kgLocalities).findOne({
    id: localityId,
  });
  const priceMovement = [
    ...(existing?.priceMovement || []),
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

  await db.collection(RESEARCH_COLLECTIONS.kgLocalities).updateOne(
    { id: localityId },
    {
      $set: {
        propertyCount: properties.length,
        inventoryVolume: active.length,
        averageRent: rents.length
          ? Math.round(rents.reduce((a, b) => a + b, 0) / rents.length)
          : undefined,
        averageSalePrice: sales.length
          ? Math.round(sales.reduce((a, b) => a + b, 0) / sales.length)
          : undefined,
        popularConfigurations,
        brokerConcentration,
        priceMovement,
        marketActivity7d,
        lastSeenAt: now,
        updatedAt: now,
      },
    },
  );
}
