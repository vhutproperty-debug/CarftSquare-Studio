import { RESEARCH_COLLECTIONS } from '@/lib/research/collections';
import type { KgBroker, KgProperty } from '@/lib/research/graph/types';
import { ensureKnowledgeGraphIndexes } from '@/lib/research/graph/indexes';
import { ensureResearchIndexes, getResearchDatabase } from '@/lib/research/store';

/** Recompute broker profile from collected properties only. */
export async function recomputeBrokerStats(workspaceId: string, brokerId: string): Promise<void> {
  const db = await getResearchDatabase();
  await ensureResearchIndexes(db);
  await ensureKnowledgeGraphIndexes(db);

  const properties = await db
    .collection<KgProperty>(RESEARCH_COLLECTIONS.kgProperties)
    .find({ workspaceId, brokerId })
    .toArray();

  const active = properties.filter((p) => p.status === 'active');
  const projects = Array.from(
    new Set(active.map((p) => p.projectName).filter(Boolean) as string[]),
  );
  const portals = Array.from(new Set(active.flatMap((p) => p.portalKeys)));
  const exclusive = active.filter((p) => p.portalKeys.length === 1).length;
  const rents = active.map((p) => p.rent).filter((n): n is number => n != null);
  const multiPortal = active.filter((p) => p.portalKeys.length > 1).length;

  const quality =
    active.length === 0
      ? 50
      : Math.round(
          40
          + Math.min(30, active.filter((p) => p.carpetArea != null).length * 5)
          + Math.min(30, active.filter((p) => p.unit).length * 5),
        );
  const duplicateBehavior = active.length
    ? Math.round(100 - (multiPortal / active.length) * 50)
    : 50;

  const patch: Partial<KgBroker> = {
    activeListingCount: active.length,
    exclusiveInventoryCount: exclusive,
    projectsCovered: projects,
    portals,
    averagePricing: rents.length
      ? Math.round(rents.reduce((a, b) => a + b, 0) / rents.length)
      : undefined,
    listingQualityScore: quality,
    duplicateBehaviorScore: duplicateBehavior,
    observationCount: properties.reduce((s, p) => s + p.observationCount, 0),
    responseFrequency: active.length,
    lastSeenAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await db.collection(RESEARCH_COLLECTIONS.kgBrokers).updateOne({ id: brokerId }, { $set: patch });
}
