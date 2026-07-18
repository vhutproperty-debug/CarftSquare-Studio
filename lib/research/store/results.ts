import { v4 as uuidv4 } from 'uuid';
import { RESEARCH_COLLECTIONS } from '@/lib/research/collections';
import { ensureResearchIndexes, getResearchDatabase } from '@/lib/research/store';
import type { ResearchListing, ResearchResult } from '@/lib/research/types';

export async function createResearchResult(input: {
  workspaceId: string;
  runId: string;
  queryId: string;
  summary?: string;
  listings?: ResearchListing[];
  payload?: Record<string, unknown>;
}): Promise<ResearchResult> {
  const db = await getResearchDatabase();
  await ensureResearchIndexes(db);
  const doc: ResearchResult = {
    id: uuidv4(),
    workspaceId: input.workspaceId,
    runId: input.runId,
    queryId: input.queryId,
    summary: input.summary,
    listings: input.listings,
    payload: input.payload,
    createdAt: new Date().toISOString(),
  };
  await db.collection(RESEARCH_COLLECTIONS.results).insertOne(doc);
  return doc;
}

export async function getResearchResultByRunId(runId: string): Promise<ResearchResult | null> {
  const db = await getResearchDatabase();
  await ensureResearchIndexes(db);
  return db.collection<ResearchResult>(RESEARCH_COLLECTIONS.results).findOne({ runId });
}

export async function listResearchResults(workspaceId: string, limit = 50): Promise<ResearchResult[]> {
  const db = await getResearchDatabase();
  await ensureResearchIndexes(db);
  return db
    .collection<ResearchResult>(RESEARCH_COLLECTIONS.results)
    .find({ workspaceId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray();
}
