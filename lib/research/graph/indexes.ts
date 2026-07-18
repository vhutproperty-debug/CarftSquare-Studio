import type { Db } from 'mongodb';
import { RESEARCH_COLLECTIONS } from '@/lib/research/collections';

/** Knowledge-graph indexes — safe to call repeatedly. */
export async function ensureKnowledgeGraphIndexes(db: Db): Promise<void> {
  await Promise.all([
    db.collection(RESEARCH_COLLECTIONS.kgProperties).createIndex({ id: 1 }, { unique: true }),
    db.collection(RESEARCH_COLLECTIONS.kgProperties).createIndex(
      { workspaceId: 1, 'identity.fingerprint': 1 },
      { unique: true },
    ),
    db.collection(RESEARCH_COLLECTIONS.kgProperties).createIndex({
      workspaceId: 1,
      'identity.altFingerprints': 1,
    }),
    db.collection(RESEARCH_COLLECTIONS.kgProperties).createIndex({ workspaceId: 1, lastSeenAt: -1 }),
    db.collection(RESEARCH_COLLECTIONS.kgProperties).createIndex({ workspaceId: 1, status: 1 }),
    db.collection(RESEARCH_COLLECTIONS.kgProperties).createIndex({ workspaceId: 1, projectId: 1 }),
    db.collection(RESEARCH_COLLECTIONS.kgProperties).createIndex({ workspaceId: 1, brokerId: 1 }),
    db.collection(RESEARCH_COLLECTIONS.kgProperties).createIndex({ workspaceId: 1, localityId: 1 }),
    db.collection(RESEARCH_COLLECTIONS.kgProperties).createIndex({ workspaceId: 1, daysOnMarket: -1 }),
    db.collection(RESEARCH_COLLECTIONS.kgProperties).createIndex({ workspaceId: 1, portalKeys: 1 }),

    db.collection(RESEARCH_COLLECTIONS.kgProjects).createIndex({ id: 1 }, { unique: true }),
    db.collection(RESEARCH_COLLECTIONS.kgProjects).createIndex(
      { workspaceId: 1, nameKey: 1 },
      { unique: true },
    ),
    db.collection(RESEARCH_COLLECTIONS.kgBuildings).createIndex({ id: 1 }, { unique: true }),
    db.collection(RESEARCH_COLLECTIONS.kgBuildings).createIndex(
      { workspaceId: 1, nameKey: 1, projectId: 1 },
    ),
    db.collection(RESEARCH_COLLECTIONS.kgTowers).createIndex({ id: 1 }, { unique: true }),
    db.collection(RESEARCH_COLLECTIONS.kgTowers).createIndex({
      workspaceId: 1,
      nameKey: 1,
      projectId: 1,
    }),
    db.collection(RESEARCH_COLLECTIONS.kgLocalities).createIndex({ id: 1 }, { unique: true }),
    db.collection(RESEARCH_COLLECTIONS.kgLocalities).createIndex(
      { workspaceId: 1, nameKey: 1 },
      { unique: true },
    ),
    db.collection(RESEARCH_COLLECTIONS.kgBrokers).createIndex({ id: 1 }, { unique: true }),
    db.collection(RESEARCH_COLLECTIONS.kgBrokers).createIndex(
      { workspaceId: 1, nameKey: 1 },
      { unique: true },
    ),
    db.collection(RESEARCH_COLLECTIONS.kgBuilders).createIndex({ id: 1 }, { unique: true }),
    db.collection(RESEARCH_COLLECTIONS.kgBuilders).createIndex(
      { workspaceId: 1, nameKey: 1 },
      { unique: true },
    ),
    db.collection(RESEARCH_COLLECTIONS.kgPortals).createIndex({ id: 1 }, { unique: true }),
    db.collection(RESEARCH_COLLECTIONS.kgPortals).createIndex(
      { workspaceId: 1, key: 1 },
      { unique: true },
    ),
    db.collection(RESEARCH_COLLECTIONS.kgListings).createIndex({ id: 1 }, { unique: true }),
    db.collection(RESEARCH_COLLECTIONS.kgListings).createIndex({ workspaceId: 1, propertyId: 1 }),
    db.collection(RESEARCH_COLLECTIONS.kgListings).createIndex({
      workspaceId: 1,
      portal: 1,
      externalUrl: 1,
    }),

    db.collection(RESEARCH_COLLECTIONS.kgEdges).createIndex({ id: 1 }, { unique: true }),
    db.collection(RESEARCH_COLLECTIONS.kgEdges).createIndex({
      workspaceId: 1,
      type: 1,
      fromId: 1,
      toId: 1,
    }),
    db.collection(RESEARCH_COLLECTIONS.kgEdges).createIndex({ workspaceId: 1, fromId: 1 }),
    db.collection(RESEARCH_COLLECTIONS.kgEdges).createIndex({ workspaceId: 1, toId: 1 }),

    db.collection(RESEARCH_COLLECTIONS.kgObservations).createIndex({ id: 1 }, { unique: true }),
    db.collection(RESEARCH_COLLECTIONS.kgObservations).createIndex({
      workspaceId: 1,
      propertyId: 1,
      observedAt: -1,
    }),
    db.collection(RESEARCH_COLLECTIONS.kgObservations).createIndex({
      workspaceId: 1,
      researchSessionId: 1,
    }),

    db.collection(RESEARCH_COLLECTIONS.kgChanges).createIndex({ id: 1 }, { unique: true }),
    db.collection(RESEARCH_COLLECTIONS.kgChanges).createIndex({
      workspaceId: 1,
      propertyId: 1,
      detectedAt: -1,
    }),
    db.collection(RESEARCH_COLLECTIONS.kgChanges).createIndex({
      workspaceId: 1,
      type: 1,
      detectedAt: -1,
    }),

    db.collection(RESEARCH_COLLECTIONS.kgTimeline).createIndex({ id: 1 }, { unique: true }),
    db.collection(RESEARCH_COLLECTIONS.kgTimeline).createIndex({
      workspaceId: 1,
      propertyId: 1,
      at: -1,
    }),
    db.collection(RESEARCH_COLLECTIONS.kgAliases).createIndex({ id: 1 }, { unique: true }),
    db.collection(RESEARCH_COLLECTIONS.kgAliases).createIndex(
      { workspaceId: 1, entityType: 1, aliasKey: 1 },
      { unique: true },
    ),
    db.collection(RESEARCH_COLLECTIONS.kgAliases).createIndex({
      workspaceId: 1,
      entityType: 1,
      canonicalKey: 1,
    }),
    db.collection(RESEARCH_COLLECTIONS.kgProperties).createIndex({
      workspaceId: 1,
      imageFingerprints: 1,
    }),
    db.collection(RESEARCH_COLLECTIONS.kgObservations).createIndex({
      workspaceId: 1,
      observedAt: -1,
    }),
  ]);
}
