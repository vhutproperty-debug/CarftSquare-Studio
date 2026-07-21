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
  if (/page crashed|target closed|browser.*crash|has been closed/i.test(lower)) {
    return 'Browser page crashed during validation. Session may be corrupt — reconnect.';
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

function suggestedActionFor(input: {
  displayState: ConnectorDisplayState;
  humanError: string | null;
  workerOnline: boolean;
  rawError?: string | null;
}): string | null {
  const { displayState, humanError, workerOnline, rawError } = input;
  if (!workerOnline) {
    return 'Start the Browser Worker (`npm run research:browser-worker`), then retry validation.';
  }
  if (/page crashed|target closed|browser.*crash/i.test(String(rawError || humanError || ''))) {
    return 'Retry validation — a fresh browser page will be used. Reconnect only if retries keep failing.';
  }
  if (displayState === 'session_expired') {
    return 'Click Reconnect, complete portal login, and wait until Research Ready.';
  }
  if (displayState === 'connection_failed') {
    return humanError
      ? `Retry validation. If it fails again: ${humanError}`
      : 'Retry validation, then reconnect if the session is still invalid.';
  }
  if (displayState === 'never_connected') {
    return 'Connect this portal and complete login before running research.';
  }
  if (displayState === 'reconnecting') {
    return 'Finish login in the secure browser window.';
  }
  return null;
}

/**
 * Build a self-diagnosing checklist from existing status signals (no new infra).
 */
export function buildConnectorDiagnostics(input: {
  display: ConnectorDisplayMeta;
  health: 'healthy' | 'degraded' | 'failing' | 'unknown' | 'idle';
  workerOnline: boolean;
  browser?: ResearchBrowserSession | null;
  lastValidatedAt?: string;
  liveValidated?: boolean;
  validationLatencyMs?: number | null;
  rawError?: string | null;
}): import('@/lib/research/browser-gateway/types').ConnectorDiagnostics {
  const {
    display,
    health,
    workerOnline,
    browser,
    lastValidatedAt,
    liveValidated,
    validationLatencyMs,
    rawError,
  } = input;

  const loginOk = browser?.sessionStatus === 'valid' && display.sessionExists;
  const researchReady = display.availableForResearch;

  const checks: import('@/lib/research/browser-gateway/types').ConnectorDiagnosticCheck[] = [
    {
      id: 'worker',
      label: 'Worker online',
      ok: workerOnline,
      detail: workerOnline ? 'Confirmed via worker status' : 'Browser worker unreachable',
    },
    {
      id: 'browser',
      label: 'Browser session record',
      ok: Boolean(browser?.id),
      detail: browser?.id
        ? `Stored session ${browser.id.slice(0, 8)}… (not a live browser probe)`
        : 'No browser session row',
    },
    {
      id: 'context',
      label: 'Encrypted cookies stored',
      ok: display.sessionExists,
      detail: display.sessionExists
        ? 'Cookies present in session store'
        : 'No saved cookies',
    },
    {
      id: 'login',
      label: 'Login status (stored)',
      ok: display.displayState === 'never_connected' ? null : loginOk,
      detail: browser?.sessionStatus
        ? `sessionStatus=${browser.sessionStatus}`
        : undefined,
    },
    {
      id: 'cookies',
      label: 'Session cookies recorded',
      ok: display.sessionExists,
      detail: display.sessionExists ? 'Presence only — contents never exposed' : undefined,
    },
    {
      id: 'portal',
      label: liveValidated ? 'Last live validation' : 'Last validation (cached)',
      ok:
        display.displayState === 'connected'
          ? true
          : display.displayState === 'connection_failed'
            ? false
            : null,
      detail:
        display.displayState === 'connection_failed'
          ? display.humanError || 'Stored validation failed'
          : liveValidated
            ? 'Result from live worker validate'
            : 'Inferred from stored session — not a live reachability probe',
    },
    {
      id: 'research_ready',
      label: 'Available for research',
      ok: researchReady,
      detail: display.availableLabel,
    },
  ];

  const failureReason =
    display.displayState === 'connected' ? null : display.humanError || humanizeConnectorError(rawError);

  let browserState = 'idle';
  if (display.displayState === 'reconnecting') browserState = 'connecting';
  else if (display.displayState === 'connected') browserState = 'session_valid_stored';
  else if (display.displayState === 'connection_failed') browserState = 'error_stored';
  else if (display.displayState === 'session_expired') browserState = 'needs_login';
  else if (display.sessionExists) browserState = 'cookies_stored';

  let validationResult = 'not_run';
  if (display.displayState === 'connected') validationResult = 'passed';
  else if (display.displayState === 'connection_failed') validationResult = 'failed';
  else if (display.displayState === 'session_expired') validationResult = 'expired';
  else if (display.displayState === 'reconnecting') validationResult = 'in_progress';
  else if (display.displayState === 'never_connected') validationResult = 'not_connected';

  return {
    checks,
    currentState: display.displayState,
    health,
    lastVerification: lastValidatedAt || browser?.lastVerified,
    researchReady,
    browserState,
    sessionAgeLabel: display.sessionAgeLabel,
    validationResult,
    latencyMs: validationLatencyMs ?? null,
    failureReason,
    suggestedAction: suggestedActionFor({
      displayState: display.displayState,
      humanError: failureReason,
      workerOnline,
      rawError,
    }),
  };
}
