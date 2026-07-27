/**
 * Connector heartbeat + automatic stale-session detection (operational).
 */

import { RESEARCH_BROWSER_CONFIG, RESEARCH_PORTALS } from '@/lib/research/browser/config';
import { connectorLog } from '@/lib/research/browser/connector-log';
import { findBrowserSession, touchBrowserSession } from '@/lib/research/sessions/session-store';

/** Mark session stale when lastVerified older than this (default 12h). */
export const STALE_SESSION_MS = Number(
  process.env.RESEARCH_STALE_SESSION_MS || 12 * 60 * 60 * 1000,
);

export type ConnectorHeartbeat = {
  at: string;
  workspaceId: string;
  portal: string;
  sessionStatus: string | null;
  lastVerified: string | null;
  ageMs: number | null;
  stale: boolean;
  hasStorageState: boolean;
  action: 'none' | 'marked_needs_login' | 'skipped_fresh';
};

/**
 * Detect and optionally mark sessions that have gone too long without verification.
 * Does not open a browser — metadata-only stale detection.
 */
export async function heartbeatPortalSession(input: {
  workspaceId: string;
  portal: string;
  /** When true, flip sessionStatus to needs_login if stale. */
  markStale?: boolean;
}): Promise<ConnectorHeartbeat> {
  const session = await findBrowserSession(input.workspaceId, input.portal);
  const at = new Date().toISOString();
  if (!session) {
    return {
      at,
      workspaceId: input.workspaceId,
      portal: input.portal,
      sessionStatus: null,
      lastVerified: null,
      ageMs: null,
      stale: false,
      hasStorageState: false,
      action: 'none',
    };
  }

  const lastVerified = session.lastVerified || null;
  const ageMs = lastVerified ? Date.now() - new Date(lastVerified).getTime() : null;
  const ttlExpired =
    Boolean(session.expiresAt) && new Date(session.expiresAt!).getTime() <= Date.now();
  const staleByAge = ageMs != null && ageMs > STALE_SESSION_MS;
  const stale =
    session.sessionStatus === 'valid' &&
    (ttlExpired || staleByAge || !session.encryptedCookies);

  let action: ConnectorHeartbeat['action'] = 'none';
  if (stale && input.markStale) {
    await touchBrowserSession(session.id, {
      sessionStatus: 'needs_login',
      status: 'needs_login',
      lastValidationError: ttlExpired
        ? 'Session TTL expired (heartbeat)'
        : `Stale session — lastVerified age ${ageMs}ms > ${STALE_SESSION_MS}ms`,
    });
    action = 'marked_needs_login';
    connectorLog(input.portal, 'heartbeat_stale_marked', { ageMs, ttlExpired });
  } else if (
    session.sessionStatus === 'valid' &&
    ageMs != null &&
    ageMs < RESEARCH_BROWSER_CONFIG.validateFreshMs
  ) {
    action = 'skipped_fresh';
  }

  return {
    at,
    workspaceId: input.workspaceId,
    portal: input.portal,
    sessionStatus: session.sessionStatus || null,
    lastVerified,
    ageMs,
    stale,
    hasStorageState: Boolean(session.encryptedStorage || session.encryptedCookies),
    action,
  };
}

export async function heartbeatAllPortals(input: {
  workspaceId: string;
  markStale?: boolean;
}): Promise<ConnectorHeartbeat[]> {
  const out: ConnectorHeartbeat[] = [];
  for (const p of RESEARCH_PORTALS) {
    out.push(
      await heartbeatPortalSession({
        workspaceId: input.workspaceId,
        portal: p.key,
        markStale: input.markStale,
      }),
    );
  }
  return out;
}
