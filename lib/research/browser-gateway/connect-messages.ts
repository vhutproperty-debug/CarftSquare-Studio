/**
 * User-facing Connect status / error copy (no stack traces).
 */

export const CONNECT_USER_MESSAGES = {
  preparing: 'Preparing browser…',
  opening: 'Opening secure browser…',
  browserRetry: 'Browser could not start. Retrying…',
  profileUnavailable: 'Profile directory unavailable. Creating temporary profile…',
  profileReady: 'Browser profile ready.',
  waitingLogin: 'Waiting for login…',
  browserReady: 'Browser ready — open the secure login window to continue.',
  authenticated: 'Authenticated.',
  capturing: 'Capturing session…',
  encrypting: 'Encrypting…',
  validating: 'Validating…',
  connected: 'Connected.',
  loginTimeout: 'Login timed out before authentication was detected.',
  cancelled: 'Connect cancelled.',
  failedGeneric: 'Connect failed. Please try again.',
} as const;

/** Map raw Node/Playwright errors to short operator-facing text. */
export function friendlyConnectError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error || '');
  const msg = raw.toLowerCase();

  if (/enoent|eacces|erofs|mkdir|profile directory|no writable path/i.test(msg)) {
    return CONNECT_USER_MESSAGES.profileUnavailable;
  }
  if (/could not acquire profile lock|session busy|already active/i.test(msg)) {
    return 'Another browser is already open for this Connect session. Wait or cancel, then retry.';
  }
  // Portal WAF / empty HTTP error pages (headed Chromium) — not a browser crash.
  if (
    /blocked before login surface|access denied|security alert|err_http_response_code_failure|net::err_http/i.test(
      msg,
    )
  ) {
    return 'Portal blocked this login page (security / WAF). Retry later or from a trusted network.';
  }
  if (/browser|chromium|launch|executable|xvfb|display/i.test(msg)) {
    return CONNECT_USER_MESSAGES.browserRetry;
  }
  if (/timed out|timeout/i.test(msg)) {
    return CONNECT_USER_MESSAGES.loginTimeout;
  }
  if (/cancelled|canceled/i.test(msg)) {
    return CONNECT_USER_MESSAGES.cancelled;
  }

  // Strip stack-like noise; keep one short line.
  const firstLine = raw.split('\n')[0]?.trim() || CONNECT_USER_MESSAGES.failedGeneric;
  if (firstLine.length > 160) {
    return `${firstLine.slice(0, 157)}…`;
  }
  // Prefer not to surface absolute paths / errno dumps.
  if (/\\|\bat\s+\S+:\d+|\berror:\s*error/i.test(firstLine)) {
    return CONNECT_USER_MESSAGES.failedGeneric;
  }
  return firstLine;
}
