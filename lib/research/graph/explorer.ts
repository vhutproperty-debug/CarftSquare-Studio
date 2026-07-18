import { RESEARCH_COLLECTIONS } from '@/lib/research/collections';
import { ensureBuiltinAliases } from '@/lib/research/graph/aliases';
import { ensureKnowledgeGraphIndexes } from '@/lib/research/graph/indexes';
import type {
  KgBroker,
  KgEdge,
  KgListingNode,
  KgObservation,
  KgProject,
  KgProperty,
  KgTower,
} from '@/lib/research/graph/types';
import { ensureResearchIndexes, getResearchDatabase } from '@/lib/research/store';

export type KgExplorerNode = {
  id: string;
  type: 'project' | 'tower' | 'property' | 'listing' | 'broker' | 'research' | 'observation';
  label: string;
  meta?: Record<string, unknown>;
  children?: KgExplorerNode[];
};

export async function getExplorerProjects(workspaceId: string): Promise<KgProject[]> {
  await ensureBuiltinAliases(workspaceId);
  const db = await getResearchDatabase();
  await ensureResearchIndexes(db);
  await ensureKnowledgeGraphIndexes(db);
  return db
    .collection<KgProject>(RESEARCH_COLLECTIONS.kgProjects)
    .find({ workspaceId })
    .sort({ lastSeenAt: -1 })
    .limit(100)
    .toArray();
}

export async function getExplorerTree(
  workspaceId: string,
  projectId: string,
): Promise<KgExplorerNode | null> {
  const db = await getResearchDatabase();
  await ensureResearchIndexes(db);
  await ensureKnowledgeGraphIndexes(db);

  const project = await db.collection<KgProject>(RESEARCH_COLLECTIONS.kgProjects).findOne({
    workspaceId,
    id: projectId,
  });
  if (!project) return null;

  const [towers, properties] = await Promise.all([
    db.collection<KgTower>(RESEARCH_COLLECTIONS.kgTowers).find({ workspaceId, projectId }).toArray(),
    db
      .collection<KgProperty>(RESEARCH_COLLECTIONS.kgProperties)
      .find({ workspaceId, projectId })
      .sort({ lastSeenAt: -1 })
      .limit(200)
      .toArray(),
  ]);

  const propertyIds = properties.map((p) => p.id);
  const [listings, brokers, observations, edges] = await Promise.all([
    db
      .collection<KgListingNode>(RESEARCH_COLLECTIONS.kgListings)
      .find({ workspaceId, propertyId: { $in: propertyIds } })
      .toArray(),
    db
      .collection<KgBroker>(RESEARCH_COLLECTIONS.kgBrokers)
      .find({
        workspaceId,
        id: { $in: properties.map((p) => p.brokerId).filter(Boolean) as string[] },
      })
      .toArray(),
    db
      .collection<KgObservation>(RESEARCH_COLLECTIONS.kgObservations)
      .find({ workspaceId, propertyId: { $in: propertyIds } })
      .sort({ observedAt: -1 })
      .limit(500)
      .toArray(),
    db
      .collection<KgEdge>(RESEARCH_COLLECTIONS.kgEdges)
      .find({
        workspaceId,
        $or: [
          { fromId: { $in: [projectId, ...propertyIds] } },
          { toId: { $in: [projectId, ...propertyIds] } },
        ],
      })
      .limit(500)
      .toArray(),
  ]);

  const brokerById = new Map(brokers.map((b) => [b.id, b]));
  const listingsByProperty = new Map<string, KgListingNode[]>();
  for (const l of listings) {
    const arr = listingsByProperty.get(l.propertyId) || [];
    arr.push(l);
    listingsByProperty.set(l.propertyId, arr);
  }
  const obsByProperty = new Map<string, KgObservation[]>();
  for (const o of observations) {
    const arr = obsByProperty.get(o.propertyId) || [];
    arr.push(o);
    obsByProperty.set(o.propertyId, arr);
  }

  const propertyNodes = (subset: KgProperty[]): KgExplorerNode[] =>
    subset.map((p) => {
      const portalListings = (listingsByProperty.get(p.id) || []).map((l) => ({
        id: l.id,
        type: 'listing' as const,
        label: `${l.portal}${l.externalUrl ? '' : ''}`,
        meta: {
          portal: l.portal,
          url: l.externalUrl,
          status: l.status,
          firstSeenAt: l.firstSeenAt,
          lastSeenAt: l.lastSeenAt,
        },
      }));
      const broker = p.brokerId ? brokerById.get(p.brokerId) : undefined;
      const researchSessions = Array.from(new Set(p.currentResearchSessionIds || [])).map(
        (sid) => ({
          id: sid,
          type: 'research' as const,
          label: `Research ${sid.slice(0, 8)}`,
          meta: { sessionId: sid },
        }),
      );
      const children: KgExplorerNode[] = [
        {
          id: `${p.id}:portals`,
          type: 'listing',
          label: `Portal listings (${portalListings.length})`,
          children: portalListings,
        },
      ];
      if (broker) {
        children.push({
          id: broker.id,
          type: 'broker',
          label: broker.name,
          meta: {
            activeListingCount: broker.activeListingCount,
            portals: broker.portals,
            averagePricing: broker.averagePricing,
          },
        });
      }
      children.push({
        id: `${p.id}:research`,
        type: 'research',
        label: `Research history (${researchSessions.length})`,
        children: researchSessions,
      });
      const recentObs = (obsByProperty.get(p.id) || []).slice(0, 5).map((o) => ({
        id: o.id,
        type: 'observation' as const,
        label: `${o.portal} · ${o.observedAt.slice(0, 10)}`,
        meta: { rent: o.rent, brokerName: o.brokerName },
      }));
      if (recentObs.length) {
        children.push({
          id: `${p.id}:obs`,
          type: 'observation',
          label: `Observations (${obsByProperty.get(p.id)?.length || 0})`,
          children: recentObs,
        });
      }
      return {
        id: p.id,
        type: 'property',
        label: p.title || p.unit || p.id.slice(0, 8),
        meta: {
          rent: p.rent,
          bhk: p.bhk,
          status: p.status,
          portals: p.portalKeys,
          confidence: p.identityConfidence,
          daysOnMarket: p.daysOnMarket,
        },
        children,
      };
    });

  const towerChildren: KgExplorerNode[] = towers.map((t) => ({
    id: t.id,
    type: 'tower',
    label: t.name,
    meta: { propertyCount: t.propertyCount },
    children: propertyNodes(properties.filter((p) => p.towerId === t.id)),
  }));

  const unassigned = properties.filter((p) => !p.towerId || !towers.some((t) => t.id === p.towerId));
  if (unassigned.length) {
    towerChildren.push({
      id: `${projectId}:untowered`,
      type: 'tower',
      label: 'Unassigned tower',
      children: propertyNodes(unassigned),
    });
  }

  return {
    id: project.id,
    type: 'project',
    label: project.name,
    meta: {
      averageRent: project.averageRent,
      rentalInventory: project.rentalInventory,
      inventoryGrowthPct: project.inventoryGrowthPct,
      relationships: edges.length,
    },
    children: towerChildren,
  };
}
