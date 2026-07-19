import {
  getConnectSessionById,
  updateConnectSession,
} from '@/lib/research/browser-gateway/connect-session-store';
import type { ConnectFlowPhase, ConnectSession } from '@/lib/research/browser-gateway/types';
import { pushWorkerLog } from '@/lib/research/browser-gateway/worker-state';

/**
 * Legal connect-session transitions.
 * `connected` is ONLY reachable from `validating` after validateSession() succeeds.
 */
const ALLOWED: Record<ConnectFlowPhase, ConnectFlowPhase[]> = {
  queued: ['connecting', 'cancelled', 'expired', 'failed'],
  // validating: refresh/validate-only jobs skip the headed login path.
  connecting: ['opening_browser', 'validating', 'cancelled', 'expired', 'failed'],
  opening_browser: ['waiting_for_login', 'cancelled', 'expired', 'failed'],
  // opening_browser allowed again after validation retry (reopen headed Chromium).
  waiting_for_login: ['capturing', 'opening_browser', 'cancelled', 'expired', 'failed'],
  capturing: ['encrypting', 'waiting_for_login', 'cancelled', 'expired', 'failed'],
  encrypting: ['validating', 'waiting_for_login', 'cancelled', 'expired', 'failed'],
  validating: ['connected', 'waiting_for_login', 'opening_browser', 'failed', 'cancelled', 'expired'],
  connected: [],
  failed: [],
  expired: [],
  cancelled: [],
};

export type ConnectTransitionMeta = {
  sessionId: string;
  to: ConnectFlowPhase;
  message?: string;
  errorMessage?: string | null;
  caller: string;
  /** Required when to === 'connected' — proves validation gate. */
  validationOk?: boolean;
  cookieCount?: number;
  browserSessionId?: string;
  liveViewUrl?: string | null;
  browserVersion?: string;
  previewPath?: string;
  workerId?: string;
  finishedAt?: string;
};

/**
 * Apply a phase transition with structured logging.
 * Rejects illegal jumps (especially Connected without Validation Passed).
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
  const allowed = ALLOWED[from] || [];
  const legal = from === meta.to || allowed.includes(meta.to);

  if (meta.to === 'connected') {
    if (from !== 'validating') {
      pushWorkerLog(
        'error',
        `connect_transition_BLOCKED sessionId=${meta.sessionId} from=${from} to=connected caller=${meta.caller} reason=connected_only_from_validating`,
      );
      throw new Error(
        `Illegal Connected transition from ${from} (caller=${meta.caller}). Connected requires Validation Passed.`,
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
      `connect_transition_BLOCKED sessionId=${meta.sessionId} from=${from} to=${meta.to} caller=${meta.caller} allowed=${allowed.join('|') || 'none'}`,
    );
    throw new Error(
      `Illegal connect phase transition ${from} → ${meta.to} (caller=${meta.caller})`,
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

  // ASCII pipeline breadcrumb for Railway logs
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
  if (to === 'capturing') return 'Authentication Detected → Cookies Capturing';
  if (to === 'encrypting') return 'Cookies Captured → Encrypted';
  if (to === 'validating') return 'Validation Started';
  if (to === 'connected') return 'Validation Passed → Connected';
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
    'capturing',
    'encrypting',
    'validating',
    'connected',
  ];
  const labels: Record<string, string> = {
    queued: 'Queued',
    connecting: 'Connecting',
    opening_browser: 'Browser Ready',
    waiting_for_login: 'Waiting for Login',
    capturing: 'Cookies Captured',
    encrypting: 'Encrypted',
    validating: 'Validation Started',
    connected: 'Connected',
  };
  const idx = order.indexOf(phase);
  if (idx < 0) return labels[phase] || phase;
  return order
    .slice(0, idx + 1)
    .map((p) => labels[p] || p)
    .join(' → ');
}
