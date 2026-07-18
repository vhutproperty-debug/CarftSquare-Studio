import { v4 as uuidv4 } from 'uuid';
import { RESEARCH_COLLECTIONS } from '@/lib/research/collections';
import { ensureResearchIndexes, getResearchDatabase } from '@/lib/research/store';
import type {
  ResearchAiProgress,
  ResearchAiSession,
  ResearchAiSessionStatus,
  ResearchReport,
  ResearchScoredListing,
} from '@/lib/research/types';

function defaultProgress(): ResearchAiProgress {
  const now = new Date().toISOString();
  return {
    phase: 'idle',
    percent: 0,
    message: 'Ready',
    portalsTotal: 0,
    portalsDone: 0,
    listingsCollected: 0,
    duplicatesRemoved: 0,
    updatedAt: now,
  };
}

export async function createAiSession(input: {
  workspaceId: string;
  createdBy: string;
  title?: string;
}): Promise<ResearchAiSession> {
  const db = await getResearchDatabase();
  await ensureResearchIndexes(db);
  const now = new Date().toISOString();
  const doc: ResearchAiSession = {
    id: uuidv4(),
    workspaceId: input.workspaceId,
    createdBy: input.createdBy,
    title: input.title || 'New research session',
    status: 'active',
    goals: [],
    filters: { city: 'Mumbai', portals: [] },
    exclusions: [],
    assumptions: [],
    messages: [],
    progress: defaultProgress(),
    queryIds: [],
    runIds: [],
    listings: [],
    auditLog: [],
    createdAt: now,
    updatedAt: now,
  };
  await db.collection(RESEARCH_COLLECTIONS.aiSessions).insertOne(doc);
  return doc;
}

export async function getAiSessionById(id: string): Promise<ResearchAiSession | null> {
  const db = await getResearchDatabase();
  await ensureResearchIndexes(db);
  return db.collection<ResearchAiSession>(RESEARCH_COLLECTIONS.aiSessions).findOne({ id });
}

export async function listAiSessions(workspaceId: string, limit = 30): Promise<ResearchAiSession[]> {
  const db = await getResearchDatabase();
  await ensureResearchIndexes(db);
  return db
    .collection<ResearchAiSession>(RESEARCH_COLLECTIONS.aiSessions)
    .find({ workspaceId })
    .sort({ updatedAt: -1 })
    .limit(limit)
    .toArray();
}

export async function saveAiSession(session: ResearchAiSession): Promise<ResearchAiSession> {
  const db = await getResearchDatabase();
  await ensureResearchIndexes(db);
  const next = { ...session, updatedAt: new Date().toISOString() };
  await db.collection(RESEARCH_COLLECTIONS.aiSessions).updateOne(
    { id: session.id },
    { $set: next },
  );
  return next;
}

export async function patchAiSession(
  id: string,
  patch: Partial<
    Pick<
      ResearchAiSession,
      | 'status'
      | 'title'
      | 'goals'
      | 'filters'
      | 'exclusions'
      | 'assumptions'
      | 'messages'
      | 'progress'
      | 'queryIds'
      | 'runIds'
      | 'listings'
      | 'report'
      | 'auditLog'
      | 'clarificationQuestion'
    >
  >,
): Promise<ResearchAiSession | null> {
  const db = await getResearchDatabase();
  await ensureResearchIndexes(db);
  await db.collection(RESEARCH_COLLECTIONS.aiSessions).updateOne(
    { id },
    { $set: { ...patch, updatedAt: new Date().toISOString() } },
  );
  return getAiSessionById(id);
}

export async function setAiSessionStatus(
  id: string,
  status: ResearchAiSessionStatus,
): Promise<void> {
  await patchAiSession(id, { status });
}

export async function setAiSessionListings(
  id: string,
  listings: ResearchScoredListing[],
): Promise<void> {
  await patchAiSession(id, { listings });
}

export async function setAiSessionReport(id: string, report: ResearchReport): Promise<void> {
  await patchAiSession(id, { report, status: 'completed' });
}
