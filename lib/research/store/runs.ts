import { v4 as uuidv4 } from 'uuid';
import { RESEARCH_COLLECTIONS } from '@/lib/research/collections';
import { ensureResearchIndexes, getResearchDatabase } from '@/lib/research/store';
import type { ResearchRun, ResearchRunStatus } from '@/lib/research/types';

export async function createResearchRun(input: {
  workspaceId: string;
  queryId: string;
  portalKeys?: string[];
}): Promise<ResearchRun> {
  const db = await getResearchDatabase();
  await ensureResearchIndexes(db);
  const now = new Date().toISOString();
  const doc: ResearchRun = {
    id: uuidv4(),
    workspaceId: input.workspaceId,
    queryId: input.queryId,
    status: 'pending',
    portalKeys: input.portalKeys,
    createdAt: now,
    updatedAt: now,
  };
  await db.collection(RESEARCH_COLLECTIONS.runs).insertOne(doc);
  return doc;
}

export async function getResearchRunById(id: string): Promise<ResearchRun | null> {
  const db = await getResearchDatabase();
  await ensureResearchIndexes(db);
  return db.collection<ResearchRun>(RESEARCH_COLLECTIONS.runs).findOne({ id });
}

export async function listResearchRuns(workspaceId: string, limit = 50): Promise<ResearchRun[]> {
  const db = await getResearchDatabase();
  await ensureResearchIndexes(db);
  return db
    .collection<ResearchRun>(RESEARCH_COLLECTIONS.runs)
    .find({ workspaceId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray();
}

export async function updateResearchRun(
  id: string,
  patch: Partial<
    Pick<ResearchRun, 'status' | 'errorMessage' | 'listingCount' | 'startedAt' | 'finishedAt' | 'portalKeys'>
  >,
): Promise<ResearchRun | null> {
  const db = await getResearchDatabase();
  await ensureResearchIndexes(db);
  await db.collection(RESEARCH_COLLECTIONS.runs).updateOne(
    { id },
    { $set: { ...patch, updatedAt: new Date().toISOString() } },
  );
  return getResearchRunById(id);
}

export async function setResearchRunStatus(
  id: string,
  status: ResearchRunStatus,
  extra?: Partial<ResearchRun>,
): Promise<void> {
  await updateResearchRun(id, { status, ...extra });
}
