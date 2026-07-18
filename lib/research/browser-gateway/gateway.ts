import { RESEARCH_COLLECTIONS } from '@/lib/research/collections';
import { getPortalMeta, RESEARCH_PORTALS } from '@/lib/research/browser/config';
import { resolveBrowserProvider } from '@/lib/research/browser-gateway/adapters';
import {
  createConnectSession,
  getConnectSessionById,
  listConnectSessions,
  publicConnectSession,
  updateConnectSession,
} from '@/lib/research/browser-gateway/connect-session-store';
// updateConnectSession used by startRemoteConnect / disconnect
import type {
  ConnectorStatusCard,
  PublicConnectSession,
} from '@/lib/research/browser-gateway/types';
import { createNotification } from '@/lib/research/monitoring/notification-store';
import {
  findBrowserSession,
  touchBrowserSession,
} from '@/lib/research/sessions/session-store';
import { researchBrowserManager } from '@/lib/research/browser/browser-manager';
import { RESEARCH_PRODUCT } from '@/lib/research/business';
import { ensureResearchIndexes, getResearchDatabase } from '@/lib/research/store';
import {
  findPortalConnection,
  upsertPortalConnection,
} from '@/lib/research/store/portal-connections';
import { listPortalConnectors } from '@/connectors/registry';
import { v4 as uuidv4 } from 'uuid';

/**
 * Browser Gateway — orchestration used by Next.js APIs.
 * Never launches Playwright. Workers claim connect sessions instead.
 */
export async function startRemoteConnect(input: {
  workspaceId: string;
  portal: string;
  createdBy: string;
}): Promise<{ connectSession: PublicConnectSession }> {
  const meta = getPortalMeta(input.portal);
  if (!meta) throw new Error(`Unknown portal: ${input.portal}`);

  const { fetchBrowserWorkerStatus } = await import(
    '@/lib/research/browser-gateway/worker-client'
  );
  const worker = await fetchBrowserWorkerStatus();
  if (!worker.online) {
    throw new Error(
      'Browser Worker is not running. Start it using:\nnpm run research:browser-worker',
    );
  }

  await upsertPortalConnection({
    workspaceId: input.workspaceId,
    portalKey: input.portal,
    portalName: meta.displayName,
    status: 'pending',
  });

  const session = await createConnectSession({
    workspaceId: input.workspaceId,
    portal: input.portal,
    portalName: meta.displayName,
    loginUrl: meta.loginUrl,
    createdBy: input.createdBy,
    provider: resolveBrowserProvider(),
  });

  await updateConnectSession(session.id, {
    phase: 'queued',
    message: 'Queueing…',
  });

  await audit(input.workspaceId, input.createdBy, 'connector_connect_started', {
    portal: input.portal,
    connectSessionId: session.id,
    provider: session.provider,
    workerId: worker.workerId,
  });

  return {
    connectSession: publicConnectSession({
      ...session,
      phase: 'queued',
      message: 'Queueing…',
    }),
  };
}

export async function getConnectSessionPublic(id: string): Promise<PublicConnectSession | null> {
  const session = await getConnectSessionById(id);
  return session ? publicConnectSession(session) : null;
}

export async function listConnectorStatuses(workspaceId: string): Promise<{
  connectors: ConnectorStatusCard[];
  activeConnectSessions: PublicConnectSession[];
}> {
  const db = await getResearchDatabase();
  await ensureResearchIndexes(db);

  const [connections, sessions, activeConnects, lastJobs] = await Promise.all([
    Promise.all(
      listPortalConnectors().map(async (c) => {
        const row = await findPortalConnection(workspaceId, c.key);
        return (
          row || {
            id: `virtual-${c.key}`,
            workspaceId,
            portalKey: c.key,
            portalName: c.displayName,
            status: 'disconnected' as const,
            createdAt: new Date(0).toISOString(),
            updatedAt: new Date(0).toISOString(),
          }
        );
      }),
    ),
    Promise.all(RESEARCH_PORTALS.map((p) => findBrowserSession(workspaceId, p.key))),
    listConnectSessions(workspaceId, { activeOnly: true }),
    db
      .collection(RESEARCH_COLLECTIONS.watchJobs)
      .find({ workspaceId, status: 'completed' })
      .sort({ finishedAt: -1 })
      .limit(20)
      .toArray(),
  ]);

  const sessionByPortal = new Map(
    sessions.filter(Boolean).map((s) => [s!.portal || s!.portalKey, s!]),
  );
  const activeByPortal = new Map(activeConnects.map((c) => [c.portal, c]));

  const connectors: ConnectorStatusCard[] = connections.map((c) => {
    const browser = sessionByPortal.get(c.portalKey);
    const active = activeByPortal.get(c.portalKey);
    let status: ConnectorStatusCard['status'] = c.status;
    if (active) status = 'connecting';
    else if (browser?.sessionStatus === 'needs_login') status = 'needs_login';
    else if (browser?.sessionStatus === 'expired') status = 'expired';
    else if (browser?.sessionStatus === 'valid' && c.status === 'connected') status = 'connected';

    let health: ConnectorStatusCard['health'] = 'unknown';
    if (status === 'connected') health = 'healthy';
    else if (status === 'needs_login' || status === 'expired') health = 'degraded';
    else if (status === 'error') health = 'failing';
    else if (status === 'disconnected') health = 'idle';
    else if (status === 'connecting') health = 'unknown';

    const lastCrawl = lastJobs.find((j) =>
      String((j.evidence as { criteria?: { portals?: string[] } } | undefined)?.criteria?.portals || '')
        .includes(c.portalKey),
    );

    return {
      portal: c.portalKey,
      portalName: c.portalName,
      status,
      health,
      lastLoginAt: browser?.lastVerified || browser?.updatedAt,
      lastValidatedAt: browser?.lastVerified,
      sessionExpiresAt: browser?.expiresAt,
      lastCrawlAt: lastCrawl?.finishedAt as string | undefined,
      connectPhase: active?.phase,
      activeConnectSessionId: active?.id,
      browserSessionId: browser?.id,
      workerId: active?.workerId,
      browserVersion: active?.browserVersion,
      provider: active?.provider || resolveBrowserProvider(),
    };
  });

  return {
    connectors,
    activeConnectSessions: activeConnects.map(publicConnectSession),
  };
}

export async function disconnectPortal(input: {
  workspaceId: string;
  portal: string;
  actorId: string;
}): Promise<void> {
  const meta = getPortalMeta(input.portal);
  if (!meta) throw new Error(`Unknown portal: ${input.portal}`);

  // Cancel active connect sessions
  const active = await listConnectSessions(input.workspaceId, {
    portal: input.portal,
    activeOnly: true,
  });
  for (const s of active) {
    await updateConnectSession(s.id, {
      phase: 'cancelled',
      message: 'Disconnected by user',
      finishedAt: new Date().toISOString(),
    });
  }

  await researchBrowserManager.cleanup(input.workspaceId, input.portal);

  const browser = await findBrowserSession(input.workspaceId, input.portal);
  if (browser) {
    const db = await getResearchDatabase();
    await db.collection(RESEARCH_COLLECTIONS.browserSessions).updateOne(
      { id: browser.id },
      {
        $set: {
          sessionStatus: 'needs_login',
          status: 'needs_login',
          updatedAt: new Date().toISOString(),
        },
        $unset: { encryptedCookies: '', encryptedStorage: '' },
      },
    );
  }

  // Best-effort profile wipe
  try {
    const fs = await import('fs/promises');
    const profile = researchBrowserManager.profilePath(input.workspaceId, input.portal);
    await fs.rm(profile, { recursive: true, force: true });
  } catch {
    /* profile may already be gone */
  }

  await upsertPortalConnection({
    workspaceId: input.workspaceId,
    portalKey: input.portal,
    portalName: meta.displayName,
    status: 'disconnected',
  });

  await audit(input.workspaceId, input.actorId, 'connector_disconnected', {
    portal: input.portal,
  });
}

export async function reconnectPortal(input: {
  workspaceId: string;
  portal: string;
  createdBy: string;
}): Promise<{ connectSession: PublicConnectSession }> {
  await disconnectPortal({
    workspaceId: input.workspaceId,
    portal: input.portal,
    actorId: input.createdBy,
  });
  return startRemoteConnect(input);
}

/** Soft refresh: re-validate via worker queue signal — not Playwright in Next. */
export async function requestSessionRefresh(input: {
  workspaceId: string;
  portal: string;
  actorId: string;
}): Promise<{ queued: true; message: string }> {
  const meta = getPortalMeta(input.portal);
  const created = await createConnectSession({
    workspaceId: input.workspaceId,
    portal: input.portal,
    portalName: meta?.displayName || input.portal,
    loginUrl: meta?.loginUrl || '',
    createdBy: input.actorId,
    provider: resolveBrowserProvider(),
  });
  const db = await getResearchDatabase();
  await db.collection(RESEARCH_COLLECTIONS.connectSessions).updateOne(
    { id: created.id },
    {
      $set: {
        message: 'Queued for session validation refresh',
        validateOnly: true,
      },
    },
  );
  await audit(input.workspaceId, input.actorId, 'connector_refresh_queued', {
    portal: input.portal,
    connectSessionId: created.id,
  });
  return {
    queued: true,
    message: 'Refresh queued for browser worker. Session will be re-validated shortly.',
  };
}

export async function notifySessionNeedsLogin(input: {
  workspaceId: string;
  portal: string;
}): Promise<void> {
  const meta = getPortalMeta(input.portal);
  await createNotification({
    workspaceId: input.workspaceId,
    category: 'insight',
    severity: 'medium',
    title: `${meta?.displayName || input.portal} needs login`,
    body: `The encrypted portal session expired or failed validation. Reconnect from ${RESEARCH_PRODUCT.shortName} → Connectors.`,
    evidence: {
      portal: input.portal,
      source: 'session_auto_validation',
      timeline: [{ at: new Date().toISOString(), event: 'needs_login' }],
    },
  });
  await upsertPortalConnection({
    workspaceId: input.workspaceId,
    portalKey: input.portal,
    portalName: meta?.displayName || input.portal,
    status: 'pending',
  });
  const browser = await findBrowserSession(input.workspaceId, input.portal);
  if (browser) {
    await touchBrowserSession(browser.id, { sessionStatus: 'needs_login' });
  }
}

async function audit(
  workspaceId: string,
  actorId: string,
  action: string,
  details?: Record<string, unknown>,
) {
  const db = await getResearchDatabase();
  await ensureResearchIndexes(db);
  await db.collection(RESEARCH_COLLECTIONS.activityLogs).insertOne({
    id: uuidv4(),
    workspaceId,
    actorId,
    action,
    resource: 'connector',
    details,
    createdAt: new Date().toISOString(),
  });
}
