import type { Db } from 'mongodb';
import { getDb } from '@/lib/mongodb';
import { RESEARCH_COLLECTIONS } from '@/lib/research/collections';
import { ensureKnowledgeGraphIndexes } from '@/lib/research/graph/indexes';
import { ensureMonitoringIndexes } from '@/lib/research/monitoring/indexes';

let indexesEnsured = false;
let indexesPromise: Promise<void> | null = null;

export async function getResearchDatabase(): Promise<Db> {
  return getDb() as Promise<Db>;
}

async function createResearchIndexes(db: Db): Promise<void> {
  await Promise.all([
    db.collection(RESEARCH_COLLECTIONS.portalConnections).createIndex({ id: 1 }, { unique: true }),
    db.collection(RESEARCH_COLLECTIONS.portalConnections).createIndex(
      { workspaceId: 1, portalKey: 1 },
      { unique: true },
    ),
    db.collection(RESEARCH_COLLECTIONS.queries).createIndex({ id: 1 }, { unique: true }),
    db.collection(RESEARCH_COLLECTIONS.queries).createIndex({ workspaceId: 1, createdAt: -1 }),
    db.collection(RESEARCH_COLLECTIONS.runs).createIndex({ id: 1 }, { unique: true }),
    db.collection(RESEARCH_COLLECTIONS.runs).createIndex({ workspaceId: 1, createdAt: -1 }),
    db.collection(RESEARCH_COLLECTIONS.runs).createIndex({ queryId: 1 }),
    db.collection(RESEARCH_COLLECTIONS.results).createIndex({ id: 1 }, { unique: true }),
    db.collection(RESEARCH_COLLECTIONS.results).createIndex({ runId: 1 }),
    db.collection(RESEARCH_COLLECTIONS.results).createIndex({ workspaceId: 1, createdAt: -1 }),
    db.collection(RESEARCH_COLLECTIONS.savedSearches).createIndex({ id: 1 }, { unique: true }),
    db.collection(RESEARCH_COLLECTIONS.savedSearches).createIndex({ workspaceId: 1, updatedAt: -1 }),
    db.collection(RESEARCH_COLLECTIONS.browserSessions).createIndex({ id: 1 }, { unique: true }),
    db.collection(RESEARCH_COLLECTIONS.browserSessions).createIndex(
      { workspaceId: 1, portal: 1 },
      { unique: true },
    ),
    db.collection(RESEARCH_COLLECTIONS.browserSessions).createIndex({ workspaceId: 1, sessionStatus: 1 }),
    db.collection(RESEARCH_COLLECTIONS.browserSessions).createIndex({ workspaceId: 1, status: 1 }),
    db.collection(RESEARCH_COLLECTIONS.activityLogs).createIndex({ id: 1 }, { unique: true }),
    db.collection(RESEARCH_COLLECTIONS.activityLogs).createIndex({ workspaceId: 1, createdAt: -1 }),
    db.collection(RESEARCH_COLLECTIONS.aiSessions).createIndex({ id: 1 }, { unique: true }),
    db.collection(RESEARCH_COLLECTIONS.aiSessions).createIndex({ workspaceId: 1, updatedAt: -1 }),
    db.collection(RESEARCH_COLLECTIONS.aiSessions).createIndex({ workspaceId: 1, status: 1 }),
  ]);
  await ensureKnowledgeGraphIndexes(db);
  await ensureMonitoringIndexes(db);
}

/** Idempotent index bootstrap for Prop/Research collections. */
export async function ensureResearchIndexes(db?: Db): Promise<void> {
  if (indexesEnsured) return;
  const database = db || (await getResearchDatabase());
  if (!indexesPromise) {
    indexesPromise = createResearchIndexes(database)
      .then(() => {
        indexesEnsured = true;
      })
      .catch((err) => {
        indexesPromise = null;
        throw err;
      });
  }
  await indexesPromise;
}
