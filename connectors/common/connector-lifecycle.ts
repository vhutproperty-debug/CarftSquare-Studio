/**
 * Shared connector lifecycle state machine.
 * All portals must progress through these states — portal code must not invent alternatives.
 */

export type ConnectorLifecycleState =
  | 'disconnected'
  | 'open_browser'
  | 'load_persistent_profile'
  | 'restore_session'
  | 'verify_login'
  | 'ready'
  | 'searching'
  | 'idle'
  | 'health_check'
  | 'error'
  | 'close_context'
  | 'close_browser'
  | 'open_new_browser'
  | 'restore_profile';

/** Legal forward transitions (recovery path included). */
const ALLOWED: Record<ConnectorLifecycleState, ConnectorLifecycleState[]> = {
  disconnected: ['open_browser', 'error'],
  open_browser: ['load_persistent_profile', 'error'],
  load_persistent_profile: ['restore_session', 'error'],
  restore_session: ['verify_login', 'error'],
  verify_login: ['ready', 'error'],
  ready: ['searching', 'idle', 'health_check', 'restore_session', 'verify_login', 'error', 'close_context'],
  searching: ['idle', 'ready', 'error'],
  idle: ['ready', 'health_check', 'searching', 'restore_session', 'verify_login', 'error', 'close_context'],
  health_check: ['ready', 'idle', 'error', 'verify_login'],
  error: ['close_context', 'disconnected'],
  close_context: ['close_browser'],
  close_browser: ['open_new_browser', 'disconnected'],
  open_new_browser: ['restore_profile', 'error'],
  restore_profile: ['verify_login', 'ready', 'idle', 'error'],
};

export function canTransition(
  from: ConnectorLifecycleState,
  to: ConnectorLifecycleState,
): boolean {
  return ALLOWED[from]?.includes(to) ?? false;
}

export function transitionOrThrow(
  from: ConnectorLifecycleState,
  to: ConnectorLifecycleState,
): ConnectorLifecycleState {
  if (!canTransition(from, to)) {
    throw new Error(`Illegal connector transition ${from} → ${to}`);
  }
  return to;
}

/** Minimum login confidence (0–100) to mark Research Ready. */
export const LOGIN_CONFIDENCE_THRESHOLD = 60;
