/**
 * Connector presentation status — human-readable states for Connectors UI.
 * Does not change persistence enums; maps stored + live signals to UX states.
 */

import { friendlyConnectError } from '@/lib/research/browser-gateway/connect-messages';
import type { ConnectFlowPhase } from '@/lib/research/browser-gateway/types';
import type {
  ResearchBrowserSession,
  ResearchPortalConnection,
} from '@/lib/research/types';

/** Visible connector states (production UX contract). */
export type ConnectorDisplayState =
  | 'connected'
  | 'session_expired'
  | 'connection_failed'
  | 'never_connected'
  | 'reconnecting';

export type ConnectorDisplayMeta = {
  displayState: ConnectorDisplayState;
  label: string;
  sessionExists: boolean;
  sessionAgeMs: number | null;
  sessionAgeLabel: string | null;
  availableForResearch: boolean;
  availableLabel: string;
  humanError: string | null;
  detailSummary: string | null;
};

const DISPLAY_LABEL: Record<ConnectorDisplayState, string> = {
  connected: 'Connected',
  session_expired: 'Session Expired',
  connection_failed: 'Connection Failed',
  never_connected: 'Not Connected',
  reconnecting: 'Reconnecting',
};

/** Map raw validation / connect failures to operator-facing copy (no stacks). */
export function humanizeConnectorError(raw?: string | null): string | null {
  if (!raw || !String(raw).trim()) return null;
  const text = String(raw).trim();
  const lower = text.toLowerCase();

  if (/worker.*(offline|unreachable|timed out)|chromium validation runs only/i.test(lower)) {
    return 'Browser worker is offline. Start the worker, then retry.';
  }
  if (/needs.?login|login required|please log in|sign in/i.test(lower)) {
    return 'Portal login expired. Reconnect to continue research.';
  }
  if (/expired|session expired|ttl/i.test(lower)) {
    return 'Session expired. Reconnect required.';
  }
  if (/401|403|unauthorized|forbidden/i.test(lower)) {
    return 'Portal rejected this session. Reconnect and sign in again.';
  }
  if (/security|challenge|captcha|akamai|bot/i.test(lower)) {
    return 'Portal security check blocked validation. Reconnect and complete login.';
  }
  if (/timeout|timed out/i.test(lower)) {
    return 'Validation timed out. Retry when the portal is reachable.';
  }
  if (/no session|missing.*cookie|encryptedcookies|no cookies/i.test(lower)) {
    return 'No saved session found. Connect this portal to continue.';
  }
  if (/network|econnrefused|enotfound|fetch failed/i.test(lower)) {
    return 'Could not reach the portal. Check connectivity and retry.';
  }

  const friendly = friendlyConnectError(text);
  // Drop stack / path noise if friendlyConnectError fell through.
  if (/\\|\bat\s+\S+:\d+|\/home\/|\/var\/|node_modules/i.test(friendly)) {
    return 'Connection failed. Retry or reconnect.';
  }
  return friendly;
}

export function formatSessionAge(lastVerifiedAt?: string | null): {
  sessionAgeMs: number | null;
  sessionAgeLabel: string | null;
} {
  if (!lastVerifiedAt) return { sessionAgeMs: null, sessionAgeLabel: null };
  const t = new Date(lastVerifiedAt).getTime();
  if (!Number.isFinite(t)) return { sessionAgeMs: null, sessionAgeLabel: null };
  const ms = Math.max(0, Date.now() - t);
  const mins = Math.floor(ms / 60_000);
  if (mins < 1) return { sessionAgeMs: ms, sessionAgeLabel: 'just now' };
  if (mins < 60) {
    return { sessionAgeMs: ms, sessionAgeLabel: `${mins} min${mins === 1 ? '' : 's'}` };
  }
  const hours = Math.floor(mins / 60);
  if (hours < 48) {
    return { sessionAgeMs: ms, sessionAgeLabel: `${hours} hour${hours === 1 ? '' : 's'}` };
  }
  const days = Math.floor(hours / 24);
  return { sessionAgeMs: ms, sessionAgeLabel: `${days} day${days === 1 ? '' : 's'}` };
}

function isTerminalConnectPhase(phase?: ConnectFlowPhase): boolean {
  return !phase || phase === 'connected' || phase === 'failed' || phase === 'expired' || phase === 'cancelled';
}

function sessionExpiredByTtl(browser?: ResearchBrowserSession | null): boolean {
  if (!browser?.expiresAt) return false;
  const exp = new Date(browser.expiresAt).getTime();
  return Number.isFinite(exp) && exp <= Date.now();
}

/**
 * Derive the single visible connector state from stored connection + browser session
 * (+ optional active connect phase). Safe for UI; never exposes cookies.
 */
export function deriveConnectorDisplay(input: {
  connection: Pick<ResearchPortalConnection, 'status' | 'lastError'> & { id?: string };
  browser?: ResearchBrowserSession | null;
  connectPhase?: ConnectFlowPhase;
  workerOnline?: boolean;
}): ConnectorDisplayMeta {
  const { connection, browser, connectPhase, workerOnline = true } = input;
  const sessionExists = Boolean(browser?.encryptedCookies);
  const hadSessionBefore = Boolean(
    browser && (browser.lastVerified || browser.encryptedCookies || browser.lastValidationError),
  );
  const isVirtualNever =
    !browser &&
    (connection.id?.startsWith('virtual-') || connection.status === 'disconnected');

  const rawError =
    connection.lastError || browser?.lastValidationError || null;
  const humanError = humanizeConnectorError(rawError);
  const age = formatSessionAge(browser?.lastVerified);

  if (connectPhase && !isTerminalConnectPhase(connectPhase)) {
    return {
      displayState: 'reconnecting',
      label: DISPLAY_LABEL.reconnecting,
      sessionExists,
      ...age,
      availableForResearch: false,
      availableLabel: 'Connecting…',
      humanError: null,
      detailSummary: 'Secure browser session in progress.',
    };
  }

  if (connection.status === 'error' || browser?.sessionStatus === 'error') {
    return {
      displayState: 'connection_failed',
      label: DISPLAY_LABEL.connection_failed,
      sessionExists,
      ...age,
      availableForResearch: false,
      availableLabel: 'Unavailable',
      humanError: humanError || 'Connection failed. Retry or reconnect.',
      detailSummary: humanError || 'Connection failed.',
    };
  }

  if (
    browser?.sessionStatus === 'needs_login' ||
    browser?.sessionStatus === 'expired' ||
    sessionExpiredByTtl(browser) ||
    (hadSessionBefore && !sessionExists && connection.status !== 'connected')
  ) {
    return {
      displayState: 'session_expired',
      label: DISPLAY_LABEL.session_expired,
      sessionExists: false,
      ...age,
      availableForResearch: false,
      availableLabel: 'Reconnect required',
      humanError: humanError || 'Session expired. Reconnect required.',
      detailSummary: 'Reconnect required.',
    };
  }

  if (
    connection.status === 'connected' &&
    browser?.sessionStatus === 'valid' &&
    sessionExists &&
    !sessionExpiredByTtl(browser)
  ) {
    const available = workerOnline;
    return {
      displayState: 'connected',
      label: DISPLAY_LABEL.connected,
      sessionExists: true,
      ...age,
      availableForResearch: available,
      availableLabel: available ? 'Available for research' : 'Worker offline — not available',
      humanError: null,
      detailSummary: available ? 'Available for research' : 'Browser worker offline.',
    };
  }

  // Pending / disconnected without a prior session → never connected
  if (
    isVirtualNever ||
    (!hadSessionBefore &&
      (connection.status === 'disconnected' || connection.status === 'pending'))
  ) {
    return {
      displayState: 'never_connected',
      label: DISPLAY_LABEL.never_connected,
      sessionExists: false,
      sessionAgeMs: null,
      sessionAgeLabel: null,
      availableForResearch: false,
      availableLabel: 'Not connected',
      humanError: null,
      detailSummary: 'Not connected yet.',
    };
  }

  // Had a session but not currently valid/connected → treat as expired
  if (hadSessionBefore) {
    return {
      displayState: 'session_expired',
      label: DISPLAY_LABEL.session_expired,
      sessionExists,
      ...age,
      availableForResearch: false,
      availableLabel: 'Reconnect required',
      humanError: humanError || 'Session expired. Reconnect required.',
      detailSummary: 'Reconnect required.',
    };
  }

  return {
    displayState: 'never_connected',
    label: DISPLAY_LABEL.never_connected,
    sessionExists: false,
    sessionAgeMs: null,
    sessionAgeLabel: null,
    availableForResearch: false,
    availableLabel: 'Not connected',
    humanError: null,
    detailSummary: 'Not connected yet.',
  };
}
