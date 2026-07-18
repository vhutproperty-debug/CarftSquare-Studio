import { v4 as uuidv4 } from 'uuid';
import { RESEARCH_COLLECTIONS } from '@/lib/research/collections';
import type {
  BrowserProviderKind,
  ConnectFlowPhase,
  ConnectSession,
  PublicConnectSession,
} from '@/lib/research/browser-gateway/types';
import { ensureResearchIndexes, getResearchDatabase } from '@/lib/research/store';

const CONNECT_TTL_MS = 20 * 60 * 1000;

async function dbReady() {
  const db = await getResearchDatabase();
  await ensureResearchIndexes(db);
  await db.collection(RESEARCH_COLLECTIONS.connectSessions).createIndex({ id: 1 }, { unique: true });
  await db.collection(RESEARCH_COLLECTIONS.connectSessions).createIndex({
    workspaceId: 1,
    portal: 1,
    updatedAt: -1,
  });
  await db.collection(RESEARCH_COLLECTIONS.connectSessions).createIndex({
    phase: 1,
    createdAt: 1,
  });
  return db;
}

export function publicConnectSession(session: ConnectSession): PublicConnectSession {
  return {
    ...session,
    previewUrl: session.previewPath
      ? `/api/research/connectors/session/preview?id=${encodeURIComponent(session.id)}`
      : null,
  };
}

export async function createConnectSession(input: {
  workspaceId: string;
  portal: string;
  portalName: string;
  loginUrl: string;
  createdBy: string;
  provider: BrowserProviderKind;
}): Promise<ConnectSession> {
  const db = await dbReady();
  const now = new Date().toISOString();
  // Cancel any prior active connect for this portal
  await db.collection(RESEARCH_COLLECTIONS.connectSessions).updateMany(
    {
      workspaceId: input.workspaceId,
      portal: input.portal,
      phase: {
        $in: [
          'queued',
          'connecting',
          'opening_browser',
          'waiting_for_login',
          'capturing',
          'encrypting',
          'validating',
        ],
      },
    },
    {
      $set: {
        phase: 'cancelled',
        message: 'Superseded by a new connect request',
        finishedAt: now,
        updatedAt: now,
      },
    },
  );

  const doc: ConnectSession = {
    id: uuidv4(),
    workspaceId: input.workspaceId,
    portal: input.portal,
    portalName: input.portalName,
    phase: 'queued',
    provider: input.provider,
    loginUrl: input.loginUrl,
    message: 'Queueing…',
    createdBy: input.createdBy,
    createdAt: now,
    updatedAt: now,
    expiresAt: new Date(Date.now() + CONNECT_TTL_MS).toISOString(),
  };
  await db.collection(RESEARCH_COLLECTIONS.connectSessions).insertOne(doc);
  return doc;
}

export async function getConnectSessionById(id: string): Promise<ConnectSession | null> {
  const db = await dbReady();
  return db.collection<ConnectSession>(RESEARCH_COLLECTIONS.connectSessions).findOne({ id });
}

export async function listConnectSessions(
  workspaceId: string,
  opts?: { portal?: string; activeOnly?: boolean },
): Promise<ConnectSession[]> {
  const db = await dbReady();
  const filter: Record<string, unknown> = { workspaceId };
  if (opts?.portal) filter.portal = opts.portal;
  if (opts?.activeOnly) {
    filter.phase = {
      $in: [
        'queued',
        'connecting',
        'opening_browser',
        'waiting_for_login',
        'capturing',
        'encrypting',
        'validating',
      ],
    };
  }
  return db
    .collection<ConnectSession>(RESEARCH_COLLECTIONS.connectSessions)
    .find(filter)
    .sort({ updatedAt: -1 })
    .limit(50)
    .toArray();
}

export async function updateConnectSession(
  id: string,
  patch: Partial<
    Pick<
      ConnectSession,
      | 'phase'
      | 'workerId'
      | 'browserVersion'
      | 'liveViewUrl'
      | 'previewPath'
      | 'previewUpdatedAt'
      | 'message'
      | 'errorMessage'
      | 'browserSessionId'
      | 'startedAt'
      | 'finishedAt'
    >
  >,
): Promise<ConnectSession | null> {
  const db = await dbReady();
  await db.collection(RESEARCH_COLLECTIONS.connectSessions).updateOne(
    { id },
    { $set: { ...patch, updatedAt: new Date().toISOString() } },
  );
  return getConnectSessionById(id);
}

/** Claim next queued connect session for a browser worker (outside Next.js). */
export async function claimNextConnectSession(workerId: string): Promise<ConnectSession | null> {
  const db = await dbReady();
  const now = new Date().toISOString();
  const res = await db.collection<ConnectSession>(RESEARCH_COLLECTIONS.connectSessions).findOneAndUpdate(
    {
      phase: 'queued',
      expiresAt: { $gt: now },
    },
    {
      $set: {
        phase: 'connecting',
        workerId,
        startedAt: now,
        message: 'Browser worker accepted session',
        updatedAt: now,
      },
    },
    { sort: { createdAt: 1 }, returnDocument: 'after' },
  );
  return res || null;
}

export async function expireStaleConnectSessions(): Promise<number> {
  const db = await dbReady();
  const now = new Date().toISOString();
  const res = await db.collection(RESEARCH_COLLECTIONS.connectSessions).updateMany(
    {
      phase: {
        $in: [
          'queued',
          'connecting',
          'opening_browser',
          'waiting_for_login',
          'capturing',
          'encrypting',
          'validating',
        ],
      },
      expiresAt: { $lte: now },
    },
    {
      $set: {
        phase: 'expired',
        errorMessage: 'Connect session timed out',
        finishedAt: now,
        updatedAt: now,
      },
    },
  );
  return res.modifiedCount;
}

export function isActivePhase(phase: ConnectFlowPhase): boolean {
  return ![
    'connected',
    'failed',
    'expired',
    'cancelled',
  ].includes(phase);
}
