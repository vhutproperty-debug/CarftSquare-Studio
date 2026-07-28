/**
 * Connect session phase machine — single source of truth for Connect lifecycle.
 *
 * Production architecture (headed Connect):
 *   queued → connecting → opening_browser → waiting_for_login
 *     → verifying (same-context AuthEvidenceEngine on verifyUrl)
 *     → capturing (Playwright storageState)
 *     → encrypting (persist encrypted storageState)
 *     → connected
 *
 * Validate-only (no headed login):
 *   connecting → validating → connected
 *
 * `validating` is reserved for re-validate-of-stored-session jobs.
 * `verifying` is same-context post-login proof on the live Connect browser.
 */

import {
  getConnectSessionById,
  updateConnectSession,
} from '@/lib/research/browser-gateway/connect-session-store';
import type { ConnectFlowPhase, ConnectSession } from '@/lib/research/browser-gateway/types';
import { pushWorkerLog } from '@/lib/research/browser-gateway/worker-state';

const ALLOWED: Record<ConnectFlowPhase, ConnectFlowPhase[]> = {
  queued: ['connecting', 'cancelled', 'expired', 'failed'],
  connecting: ['opening_browser', 'validating', 'cancelled', 'expired', 'failed'],
  opening_browser: ['waiting_for_login', 'cancelled', 'expired', 'failed'],
  // After login detected: enter same-context verify (never jump to capturing first).
  waiting_for_login: ['verifying', 'cancelled', 'expired', 'failed'],
  // Same-context verify passed → capture; failed can return to waiting (auth engine retry).
  verifying: ['capturing', 'waiting_for_login', 'failed', 'cancelled', 'expired'],
  capturing: ['encrypting', 'waiting_for_login', 'failed', 'cancelled', 'expired'],
  // Persist → connected, or validating (auth engine post-persist gate), or back to waiting.
  encrypting: ['connected', 'validating', 'waiting_for_login', 'failed', 'cancelled', 'expired'],
  // Validate-only path + post-Connect connector validator gate.
  validating: ['connected', 'waiting_for_login', 'failed', 'cancelled', 'expired'],
  connected: [],
  failed: [],
  expired: [],
  cancelled: [],
};

/** Phases from which `connected` is legal when validationOk=true. */
const CONNECTED_FROM: ConnectFlowPhase[] = ['encrypting', 'validating'];

export type ConnectTransitionMeta = {
  sessionId: string;
  to: ConnectFlowPhase;
  message?: string;
  errorMessage?: string | null;
  caller: string;
  /** Required when to === 'connected' — proves verify/validate gate. */
  validationOk?: boolean;
  cookieCount?: number;
  browserSessionId?: string;
  liveViewUrl?: string | null;
  browserVersion?: string;
  previewPath?: string;
  workerId?: string;
  finishedAt?: string;
};

export function getAllowedTransitions(from: ConnectFlowPhase): ConnectFlowPhase[] {
  return [...(ALLOWED[from] || [])];
}

export function canTransition(from: ConnectFlowPhase, to: ConnectFlowPhase): boolean {
  if (from === to) return true;
  return (ALLOWED[from] || []).includes(to);
}

/**
 * Apply a phase transition with full guard instrumentation.
 * Throws on illegal jumps — callers must not swallow without logging.
 */
export async function transitionConnectSession(
  meta: ConnectTransitionMeta,
): Promise<ConnectSession | null> {
  const current = await getConnectSessionById(meta.sessionId);
  if (!current) {
    pushWorkerLog(
      'error',
      `connect_transition_missing sessionId=${meta.sessionId} to=${meta.to} caller=${meta.caller}`,
    );
    return null;
  }

  const from = current.phase;
  const allowed = getAllowedTransitions(from);
  const legal = canTransition(from, meta.to);

  // Structured guard log on every attempt (pass or fail).
  pushWorkerLog(
    'info',
    [
      `connect_transition_guard sessionId=${meta.sessionId}`,
      `portal=${current.portal}`,
      `from=${from}`,
      `requested=${meta.to}`,
      `legal=${legal}`,
      `allowed=${allowed.join('|') || 'none'}`,
      `caller=${meta.caller}`,
      `expiresAt=${current.expiresAt || 'n/a'}`,
      `expired=${current.expiresAt ? Date.now() > new Date(current.expiresAt).getTime() : false}`,
      `workerId=${current.workerId || meta.workerId || 'n/a'}`,
      meta.validationOk != null ? `validationOk=${meta.validationOk}` : '',
    ]
      .filter(Boolean)
      .join(' '),
  );

  if (meta.to === 'connected') {
    if (!CONNECTED_FROM.includes(from)) {
      const reason = `connected_only_from_${CONNECTED_FROM.join('|')}_not_from_${from}`;
      pushWorkerLog(
        'error',
        `connect_transition_BLOCKED sessionId=${meta.sessionId} from=${from} to=connected caller=${meta.caller} reason=${reason} allowed=${allowed.join('|')}`,
      );
      throw new Error(
        `Illegal Connected transition from ${from} (caller=${meta.caller}). Connected requires encrypting|validating after verify.`,
      );
    }
    if (meta.validationOk !== true) {
      pushWorkerLog(
        'error',
        `connect_transition_BLOCKED sessionId=${meta.sessionId} from=${from} to=connected caller=${meta.caller} reason=validationOk_not_true`,
      );
      throw new Error(
        `Illegal Connected transition without validationOk (caller=${meta.caller}).`,
      );
    }
  }

  if (!legal) {
    pushWorkerLog(
      'error',
      `connect_transition_BLOCKED sessionId=${meta.sessionId} from=${from} to=${meta.to} caller=${meta.caller} reason=not_in_ALLOWED allowed=${allowed.join('|') || 'none'}`,
    );
    throw new Error(
      `Illegal connect phase transition ${from} → ${meta.to} (caller=${meta.caller}). Allowed: ${allowed.join(', ') || 'none'}`,
    );
  }

  const human = describeTransition(from, meta.to);
  pushWorkerLog(
    'info',
    [
      `connect_transition sessionId=${meta.sessionId}`,
      `portal=${current.portal}`,
      `from=${from}`,
      `to=${meta.to}`,
      `step=${human}`,
      `caller=${meta.caller}`,
      meta.cookieCount != null ? `cookieCount=${meta.cookieCount}` : '',
      meta.validationOk != null ? `validationOk=${meta.validationOk}` : '',
      meta.message ? `message=${JSON.stringify(meta.message)}` : '',
    ]
      .filter(Boolean)
      .join(' '),
  );

  pushWorkerLog('info', `connect_pipeline ${pipelineBreadcrumb(meta.to)}`);

  return updateConnectSession(meta.sessionId, {
    phase: meta.to,
    message: meta.message,
    errorMessage: meta.errorMessage === null ? undefined : meta.errorMessage,
    browserSessionId: meta.browserSessionId,
    liveViewUrl: meta.liveViewUrl === null ? undefined : meta.liveViewUrl,
    browserVersion: meta.browserVersion,
    previewPath: meta.previewPath,
    workerId: meta.workerId,
    finishedAt: meta.finishedAt,
  });
}

function describeTransition(from: ConnectFlowPhase, to: ConnectFlowPhase): string {
  if (to === 'queued') return 'Queued';
  if (to === 'opening_browser' || to === 'connecting') return 'Browser Ready';
  if (to === 'waiting_for_login') return 'Waiting for Login';
  if (to === 'verifying') return 'Authentication Detected → Same-Context Verify';
  if (to === 'capturing') return 'Verified → Capturing storageState';
  if (to === 'encrypting') return 'storageState Captured → Encrypting';
  if (to === 'validating') return 'Validate-Only Started';
  if (to === 'connected') return 'Persisted → Connected / Research Ready';
  if (to === 'failed') return `Failed (from ${from})`;
  if (to === 'cancelled') return 'Cancelled';
  if (to === 'expired') return 'Expired';
  return `${from}→${to}`;
}

function pipelineBreadcrumb(phase: ConnectFlowPhase): string {
  const order: ConnectFlowPhase[] = [
    'queued',
    'connecting',
    'opening_browser',
    'waiting_for_login',
    'verifying',
    'capturing',
    'encrypting',
    'connected',
  ];
  const labels: Record<string, string> = {
    queued: 'Queued',
    connecting: 'Connecting',
    opening_browser: 'Browser Ready',
    waiting_for_login: 'Waiting for Login',
    verifying: 'Same-Context Verify',
    capturing: 'storageState Captured',
    encrypting: 'Encrypted',
    validating: 'Validate-Only',
    connected: 'Connected',
  };
  if (phase === 'validating') {
    return 'Queued → Connecting → Validate-Only';
  }
  const idx = order.indexOf(phase);
  if (idx < 0) return labels[phase] || phase;
  return order
    .slice(0, idx + 1)
    .map((p) => labels[p] || p)
    .join(' → ');
}
