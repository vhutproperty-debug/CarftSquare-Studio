import { v4 as uuidv4 } from 'uuid';
import { RESEARCH_COLLECTIONS } from '@/lib/research/collections';
import { ensureResearchIndexes, getResearchDatabase } from '@/lib/research/store';
import type { ResearchPortalConnection, ResearchPortalConnectionStatus } from '@/lib/research/types';

export async function findPortalConnection(
  workspaceId: string,
  portalKey: string,
): Promise<ResearchPortalConnection | null> {
  const db = await getResearchDatabase();
  await ensureResearchIndexes(db);
  return db.collection<ResearchPortalConnection>(RESEARCH_COLLECTIONS.portalConnections).findOne({
    workspaceId,
    portalKey,
  });
}

export async function listPortalConnections(workspaceId: string): Promise<ResearchPortalConnection[]> {
  const db = await getResearchDatabase();
  await ensureResearchIndexes(db);
  return db
    .collection<ResearchPortalConnection>(RESEARCH_COLLECTIONS.portalConnections)
    .find({ workspaceId })
    .sort({ updatedAt: -1 })
    .toArray();
}

export async function upsertPortalConnection(input: {
  workspaceId: string;
  portalKey: string;
  portalName: string;
  status: ResearchPortalConnectionStatus;
}): Promise<ResearchPortalConnection> {
  const db = await getResearchDatabase();
  await ensureResearchIndexes(db);
  const now = new Date().toISOString();
  const existing = await findPortalConnection(input.workspaceId, input.portalKey);
  if (existing) {
    const next: ResearchPortalConnection = {
      ...existing,
      portalName: input.portalName,
      status: input.status,
      lastSyncedAt: input.status === 'connected' ? now : existing.lastSyncedAt,
      updatedAt: now,
    };
    await db.collection(RESEARCH_COLLECTIONS.portalConnections).updateOne(
      { id: existing.id },
      { $set: next },
    );
    return next;
  }

  const created: ResearchPortalConnection = {
    id: uuidv4(),
    workspaceId: input.workspaceId,
    portalKey: input.portalKey,
    portalName: input.portalName,
    status: input.status,
    lastSyncedAt: input.status === 'connected' ? now : undefined,
    createdAt: now,
    updatedAt: now,
  };
  await db.collection(RESEARCH_COLLECTIONS.portalConnections).insertOne(created);
  return created;
}
