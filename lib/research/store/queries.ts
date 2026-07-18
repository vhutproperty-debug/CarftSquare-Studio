import { v4 as uuidv4 } from 'uuid';
import { RESEARCH_COLLECTIONS } from '@/lib/research/collections';
import { ensureResearchIndexes, getResearchDatabase } from '@/lib/research/store';
import type { ResearchPlanSnapshot, ResearchQuery, ResearchQueryStatus } from '@/lib/research/types';

export async function createResearchQuery(input: {
  workspaceId: string;
  title: string;
  naturalLanguage: string;
  createdBy: string;
  plan?: ResearchPlanSnapshot;
}): Promise<ResearchQuery> {
  const db = await getResearchDatabase();
  await ensureResearchIndexes(db);
  const now = new Date().toISOString();
  const doc: ResearchQuery = {
    id: uuidv4(),
    workspaceId: input.workspaceId,
    title: input.title,
    naturalLanguage: input.naturalLanguage,
    status: 'draft',
    createdBy: input.createdBy,
    plan: input.plan,
    createdAt: now,
    updatedAt: now,
  };
  await db.collection(RESEARCH_COLLECTIONS.queries).insertOne(doc);
  return doc;
}

export async function getResearchQueryById(id: string): Promise<ResearchQuery | null> {
  const db = await getResearchDatabase();
  await ensureResearchIndexes(db);
  return db.collection<ResearchQuery>(RESEARCH_COLLECTIONS.queries).findOne({ id });
}

export async function listResearchQueries(workspaceId: string, limit = 50): Promise<ResearchQuery[]> {
  const db = await getResearchDatabase();
  await ensureResearchIndexes(db);
  return db
    .collection<ResearchQuery>(RESEARCH_COLLECTIONS.queries)
    .find({ workspaceId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray();
}

export async function updateResearchQuery(
  id: string,
  patch: Partial<Pick<ResearchQuery, 'status' | 'plan' | 'title'>>,
): Promise<ResearchQuery | null> {
  const db = await getResearchDatabase();
  await ensureResearchIndexes(db);
  await db.collection(RESEARCH_COLLECTIONS.queries).updateOne(
    { id },
    { $set: { ...patch, updatedAt: new Date().toISOString() } },
  );
  return getResearchQueryById(id);
}

export async function setResearchQueryStatus(
  id: string,
  status: ResearchQueryStatus,
): Promise<void> {
  await updateResearchQuery(id, { status });
}
