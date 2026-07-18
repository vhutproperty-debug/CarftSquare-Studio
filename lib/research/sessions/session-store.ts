import { v4 as uuidv4 } from 'uuid';
import type { Filter } from 'mongodb';
import { RESEARCH_BROWSER_CONFIG } from '@/lib/research/browser/config';
import { RESEARCH_COLLECTIONS } from '@/lib/research/collections';
import { ensureResearchIndexes, getResearchDatabase } from '@/lib/research/store';
import type { ResearchBrowserSession, ResearchBrowserSessionStatus } from '@/lib/research/types';

function normalize(session: ResearchBrowserSession): ResearchBrowserSession {
  const sessionStatus = session.sessionStatus || session.status || 'idle';
  return {
    ...session,
    portal: session.portal || session.portalKey || 'housing',
    portalKey: session.portalKey || session.portal,
    sessionStatus,
    status: sessionStatus,
  };
}

export async function getBrowserSessionById(id: string): Promise<ResearchBrowserSession | null> {
  const db = await getResearchDatabase();
  await ensureResearchIndexes(db);
  const doc = await db
    .collection<ResearchBrowserSession>(RESEARCH_COLLECTIONS.browserSessions)
    .findOne({ id });
  return doc ? normalize(doc) : null;
}

export async function findBrowserSession(
  workspaceId: string,
  portal: string,
): Promise<ResearchBrowserSession | null> {
  const db = await getResearchDatabase();
  await ensureResearchIndexes(db);
  const doc = await db.collection<ResearchBrowserSession>(RESEARCH_COLLECTIONS.browserSessions).findOne({
    workspaceId,
    $or: [{ portal }, { portalKey: portal }],
  } as Filter<ResearchBrowserSession>);
  return doc ? normalize(doc) : null;
}

export async function listBrowserSessions(workspaceId: string): Promise<ResearchBrowserSession[]> {
  const db = await getResearchDatabase();
  await ensureResearchIndexes(db);
  const rows = await db
    .collection<ResearchBrowserSession>(RESEARCH_COLLECTIONS.browserSessions)
    .find({ workspaceId })
    .sort({ updatedAt: -1 })
    .toArray();
  return rows.map(normalize);
}

export async function upsertBrowserSession(input: {
  workspaceId: string;
  portal: string;
  browserProfile: string;
  encryptedCookies?: string;
  encryptedStorage?: string;
  sessionStatus: ResearchBrowserSessionStatus;
  expiresAt?: string;
  lastVerified?: string;
}): Promise<ResearchBrowserSession> {
  const db = await getResearchDatabase();
  await ensureResearchIndexes(db);
  const now = new Date().toISOString();
  const existing = await findBrowserSession(input.workspaceId, input.portal);
  const expiresAt =
    input.expiresAt
    || new Date(Date.now() + RESEARCH_BROWSER_CONFIG.sessionTtlMs).toISOString();

  if (existing) {
    const next: ResearchBrowserSession = normalize({
      ...existing,
      browserProfile: input.browserProfile,
      encryptedCookies: input.encryptedCookies ?? existing.encryptedCookies,
      encryptedStorage: input.encryptedStorage ?? existing.encryptedStorage,
      sessionStatus: input.sessionStatus,
      status: input.sessionStatus,
      lastVerified: input.lastVerified || now,
      lastUsed: now,
      expiresAt,
      updatedAt: now,
    });
    await db.collection(RESEARCH_COLLECTIONS.browserSessions).updateOne(
      { id: existing.id },
      { $set: next },
    );
    return next;
  }

  const created: ResearchBrowserSession = {
    id: uuidv4(),
    workspaceId: input.workspaceId,
    portal: input.portal,
    portalKey: input.portal,
    browserProfile: input.browserProfile,
    encryptedCookies: input.encryptedCookies,
    encryptedStorage: input.encryptedStorage,
    sessionStatus: input.sessionStatus,
    status: input.sessionStatus,
    lastVerified: input.lastVerified || now,
    lastUsed: now,
    expiresAt,
    createdAt: now,
    updatedAt: now,
  };
  await db.collection(RESEARCH_COLLECTIONS.browserSessions).insertOne(created);
  return created;
}

export async function touchBrowserSession(
  id: string,
  patch: Partial<ResearchBrowserSession>,
): Promise<ResearchBrowserSession | null> {
  const db = await getResearchDatabase();
  await ensureResearchIndexes(db);
  const now = new Date().toISOString();
  await db.collection(RESEARCH_COLLECTIONS.browserSessions).updateOne(
    { id },
    {
      $set: {
        ...patch,
        status: patch.sessionStatus || patch.status,
        updatedAt: now,
        lastUsed: now,
      },
    },
  );
  return getBrowserSessionById(id);
}

export async function markBrowserSessionExpired(id: string): Promise<void> {
  await touchBrowserSession(id, { sessionStatus: 'expired', status: 'expired' });
}
