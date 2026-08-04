/**
 * Connector API — provider-agnostic service layer.
 *
 * Standardized façade over the connector registry, browser gateway, and
 * connect-session store so internal and external modules can use authenticated
 * portal sessions without knowing connector-specific implementation details.
 *
 * Design principles (matching the existing platform):
 *  - Never launches Playwright in Next.js — browser work stays on the worker.
 *  - Never exposes secrets (cookies/storage/OTP) in any DTO.
 *  - Delegates to the same gateway/connector code paths used by the product UI,
 *    so behavior is identical regardless of the entry point.
 *  - New providers only need a `PortalConnector` registered in
 *    `connectors/registry.ts` — this layer picks them up automatically.
 */

import { listPortalConnectors, requirePortalConnector } from '@/connectors/registry';
import { usesConnectAuthEngine } from '@/lib/research/browser-gateway/connect-auth-engine';
import {
  getConnectSessionById,
  isActivePhase,
  listConnectSessions,
  publicConnectSession,
  updateConnectSession,
} from '@/lib/research/browser-gateway/connect-session-store';
import {
  disconnectPortal,
  listConnectorStatuses,
  reconnectPortal,
  requestSessionRefresh,
  startRemoteConnect,
} from '@/lib/research/browser-gateway/gateway';
import type {
  ConnectorStatusCard,
  PublicConnectSession,
} from '@/lib/research/browser-gateway/types';
import { getPortalMeta } from '@/lib/research/browser/config';
import type {
  ConnectorSearchResponse,
  ResearchListing,
  ResearchPlanCriteria,
} from '@/lib/research/types';

/* ------------------------------------------------------------------ */
/* DTOs (stable, provider-agnostic shapes)                             */
/* ------------------------------------------------------------------ */

export type ConnectorProviderInfo = {
  provider: string;
  displayName: string;
  origin?: string;
  /** How the provider authenticates during Connect. */
  authFlow: 'portal_native' | 'connect_auth_engine';
  capabilities: {
    connect: boolean;
    search: boolean;
    validate: boolean;
    liveView: boolean;
    otpViaApi: boolean;
  };
};

export type ConnectorProviderStatus = {
  provider: string;
  displayName: string;
  /** Raw connection status (disconnected/connected/pending/error/…). */
  connection: ConnectorStatusCard['status'];
  health: ConnectorStatusCard['health'];
  /** Unified operator state — preferred field for consumers. */
  state?: ConnectorStatusCard['opsState'];
  stateLabel?: string;
  /** True when the session can be used for search right now. */
  researchReady: boolean;
  sessionExists: boolean;
  lastValidatedAt?: string;
  sessionExpiresAt?: string;
  activeConnectSessionId?: string;
  degraded?: boolean;
  error?: string | null;
};

export type ConnectorHealthReport = {
  worker: {
    online: boolean;
    healthy: boolean;
    workerId: string | null;
    version?: string;
    queueSize?: number;
    activeSessions?: number;
    lastError?: string | null;
  };
  providers: ConnectorProviderStatus[];
};

export type ConnectorSearchResult = {
  ok: boolean;
  provider: string;
  listings: ResearchListing[];
  sessionStatus: ConnectorSearchResponse['sessionStatus'] | 'error';
  message?: string;
  degraded?: boolean;
  degradationReason?: string;
};

export class ConnectorApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number = 400,
  ) {
    super(message);
    this.name = 'ConnectorApiError';
  }
}

function requireKnownProvider(provider: string): string {
  const key = String(provider || '')
    .trim()
    .toLowerCase();
  if (!key) throw new ConnectorApiError('provider is required.', 400);
  try {
    requirePortalConnector(key);
  } catch {
    throw new ConnectorApiError(`Unknown provider: ${key}`, 404);
  }
  return key;
}

/* ------------------------------------------------------------------ */
/* Providers                                                           */
/* ------------------------------------------------------------------ */

export function listConnectorProviders(): ConnectorProviderInfo[] {
  return listPortalConnectors().map((c) => {
    const meta = getPortalMeta(c.key);
    return {
      provider: c.key,
      displayName: c.displayName,
      origin: meta?.origin,
      authFlow: usesConnectAuthEngine(c.key) ? 'connect_auth_engine' : 'portal_native',
      capabilities: {
        connect: true,
        search: typeof c.executeSearch === 'function',
        validate: typeof c.validateSession === 'function',
        liveView: true,
        otpViaApi: usesConnectAuthEngine(c.key),
      },
    };
  });
}

function toProviderStatus(card: ConnectorStatusCard): ConnectorProviderStatus {
  return {
    provider: card.portal,
    displayName: card.portalName,
    connection: card.status,
    health: card.health,
    state: card.opsState,
    stateLabel: card.opsStateLabel || card.displayLabel,
    researchReady: Boolean(card.availableForResearch),
    sessionExists: Boolean(card.sessionExists),
    lastValidatedAt: card.lastValidatedAt,
    sessionExpiresAt: card.sessionExpiresAt,
    activeConnectSessionId: card.activeConnectSessionId,
    degraded: card.portalDegraded,
    error: card.humanError ?? null,
  };
}

export async function getConnectorStatuses(workspaceId: string): Promise<{
  providers: ConnectorProviderStatus[];
  workerOnline: boolean;
}> {
  const { connectors, workerOnline } = await listConnectorStatuses(workspaceId);
  return { providers: connectors.map(toProviderStatus), workerOnline };
}

export async function getConnectorHealth(workspaceId: string): Promise<ConnectorHealthReport> {
  const { fetchBrowserWorkerStatus } = await import(
    '@/lib/research/browser-gateway/worker-client'
  );
  const [worker, statuses] = await Promise.all([
    fetchBrowserWorkerStatus().catch(() => null),
    getConnectorStatuses(workspaceId),
  ]);
  return {
    worker: {
      online: Boolean(worker?.online),
      healthy: Boolean(worker?.healthy),
      workerId: worker?.workerId ?? null,
      version: worker?.version,
      queueSize: worker?.queueSize,
      activeSessions: worker?.activeSessions,
      lastError: worker?.lastError ?? null,
    },
    providers: statuses.providers,
  };
}

/* ------------------------------------------------------------------ */
/* Session management                                                  */
/* ------------------------------------------------------------------ */

export async function createConnectorSession(input: {
  workspaceId: string;
  provider: string;
  actorId: string;
}): Promise<PublicConnectSession> {
  const provider = requireKnownProvider(input.provider);
  const { connectSession } = await startRemoteConnect({
    workspaceId: input.workspaceId,
    portal: provider,
    createdBy: input.actorId,
  });
  return connectSession;
}

export async function listConnectorSessions(
  workspaceId: string,
  opts?: { provider?: string; activeOnly?: boolean },
): Promise<PublicConnectSession[]> {
  const provider = opts?.provider ? requireKnownProvider(opts.provider) : undefined;
  const sessions = await listConnectSessions(workspaceId, {
    portal: provider,
    activeOnly: opts?.activeOnly,
  });
  return sessions.map(publicConnectSession);
}

export async function getConnectorSession(
  workspaceId: string,
  sessionId: string,
): Promise<PublicConnectSession | null> {
  const session = await getConnectSessionById(sessionId);
  if (!session || session.workspaceId !== workspaceId) return null;
  return publicConnectSession(session);
}

export async function cancelConnectorSession(input: {
  workspaceId: string;
  sessionId: string;
}): Promise<PublicConnectSession> {
  const session = await getConnectSessionById(input.sessionId);
  if (!session || session.workspaceId !== input.workspaceId) {
    throw new ConnectorApiError('Connect session not found.', 404);
  }
  if (!isActivePhase(session.phase)) {
    throw new ConnectorApiError(`Session is already ${session.phase}.`, 409);
  }
  await updateConnectSession(session.id, {
    phase: 'cancelled',
    message: 'Cancelled via Connector API',
    finishedAt: new Date().toISOString(),
  });
  return publicConnectSession((await getConnectSessionById(session.id))!);
}

export async function submitConnectorSessionOtp(input: {
  workspaceId: string;
  sessionId: string;
  otp: string;
}): Promise<PublicConnectSession> {
  const otp = String(input.otp || '').replace(/\D/g, '');
  if (otp.length < 4 || otp.length > 8) {
    throw new ConnectorApiError('OTP must be 4–8 digits.', 400);
  }
  const session = await getConnectSessionById(input.sessionId);
  if (!session || session.workspaceId !== input.workspaceId) {
    throw new ConnectorApiError('Connect session not found.', 404);
  }
  if (!usesConnectAuthEngine(session.portal)) {
    throw new ConnectorApiError(
      'OTP submission via API is not supported for this provider — enter OTP in LiveView.',
      400,
    );
  }
  if (session.phase !== 'waiting_for_login' && session.phase !== 'verifying') {
    throw new ConnectorApiError(
      `Session is ${session.phase} — OTP can only be submitted while waiting for login.`,
      409,
    );
  }
  await updateConnectSession(session.id, {
    pendingOtp: otp,
    pendingOtpAt: new Date().toISOString(),
    message: 'OTP received — entering into secure browser…',
    authChallenge: 'otp',
  });
  return publicConnectSession((await getConnectSessionById(session.id))!);
}

/* ------------------------------------------------------------------ */
/* Provider actions                                                    */
/* ------------------------------------------------------------------ */

export async function disconnectConnectorProvider(input: {
  workspaceId: string;
  provider: string;
  actorId: string;
}): Promise<void> {
  const provider = requireKnownProvider(input.provider);
  await disconnectPortal({
    workspaceId: input.workspaceId,
    portal: provider,
    actorId: input.actorId,
  });
}

export async function reconnectConnectorProvider(input: {
  workspaceId: string;
  provider: string;
  actorId: string;
}): Promise<PublicConnectSession> {
  const provider = requireKnownProvider(input.provider);
  const { connectSession } = await reconnectPortal({
    workspaceId: input.workspaceId,
    portal: provider,
    createdBy: input.actorId,
  });
  return connectSession;
}

export async function refreshConnectorProvider(input: {
  workspaceId: string;
  provider: string;
  actorId: string;
}): Promise<{ queued: true; message: string }> {
  const provider = requireKnownProvider(input.provider);
  return requestSessionRefresh({
    workspaceId: input.workspaceId,
    portal: provider,
    actorId: input.actorId,
  });
}

export async function validateConnectorProvider(input: {
  workspaceId: string;
  provider: string;
  /** Force a live Chromium check (bypass freshness cache). */
  force?: boolean;
}): Promise<{
  ok: boolean;
  status: string;
  message?: string;
  loginConfidence?: number;
}> {
  const provider = requireKnownProvider(input.provider);
  const connector = requirePortalConnector(provider);
  const result = await connector.validateSession(input.workspaceId, {
    force: Boolean(input.force),
  });
  return {
    ok: result.ok,
    status: result.status,
    message: result.message,
    loginConfidence: result.loginConfidence,
  };
}

/* ------------------------------------------------------------------ */
/* Search execution                                                    */
/* ------------------------------------------------------------------ */

/**
 * Execute an authenticated search on one provider.
 * Same validate → search pattern as the Research pipeline: freshness-aware
 * validation first, then a search that skips its internal re-validation.
 */
export async function executeConnectorSearch(input: {
  workspaceId: string;
  provider: string;
  criteria: ResearchPlanCriteria;
}): Promise<ConnectorSearchResult> {
  const provider = requireKnownProvider(input.provider);
  const connector = requirePortalConnector(provider);

  const validation = await connector.validateSession(input.workspaceId);
  if (!validation.ok) {
    return {
      ok: false,
      provider,
      listings: [],
      sessionStatus: 'error',
      message:
        validation.message ||
        `Session ${validation.status} — connect this provider before searching.`,
    };
  }

  const response = await connector.executeSearch({
    workspaceId: input.workspaceId,
    criteria: input.criteria,
    sessionId: validation.sessionId,
    skipValidation: true,
  });

  return {
    ok: response.ok,
    provider,
    listings: response.listings || [],
    sessionStatus: response.sessionStatus,
    message: response.message,
    degraded: response.degraded,
    degradationReason: response.degradationReason,
  };
}
