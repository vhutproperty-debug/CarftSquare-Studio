/**
 * Heuristic login detection for remote connect flows.
 *
 * Conservative on purpose: portal "login" URLs often look like profile/account
 * pages (e.g. Housing → https://housing.com/user-profile). Matching those paths
 * alone must NOT count as authenticated or the worker will capture+close before
 * the user can type credentials.
 *
 * For portals where login URL == profile URL, we require a two-phase signal:
 * 1) observe a login/OTP surface at least once, then
 * 2) observe strong post-login chrome (logout) with cookies.
 */

export type LoginDetectSignals = {
  url: string;
  bodySnippet: string;
  /** Portal login URL the connect flow navigated to. */
  loginUrl?: string;
  cookieCount?: number;
};

export type LoginDetectState = {
  /** True after we have seen a login/OTP/security-challenge surface this session. */
  sawLoginSurface: boolean;
};

function normalizePath(raw: string): string {
  try {
    const u = new URL(raw);
    return `${u.origin}${u.pathname}`.replace(/\/+$/, '').toLowerCase();
  } catch {
    return String(raw || '')
      .split('?')[0]
      .replace(/\/+$/, '')
      .toLowerCase();
  }
}

export function isSecurityChallenge(url: string, body: string): boolean {
  return (
    body.includes('security alert') ||
    body.includes('access denied') ||
    body.includes('attention required') ||
    body.includes('cf-browser-verification') ||
    body.includes('akamai') ||
    /\/_sec\b|\/challenge\b|\/cdn-cgi\b/.test(url)
  );
}

export function hasLoginForm(body: string): boolean {
  return (
    body.includes('enter otp') ||
    body.includes('enter password') ||
    body.includes('sign in') ||
    body.includes('log in') ||
    body.includes('login with') ||
    body.includes('continue with') ||
    body.includes('phone number') ||
    body.includes('mobile number') ||
    body.includes('get otp') ||
    body.includes('request otp') ||
    body.includes('verify otp') ||
    body.includes('type="password"') ||
    body.includes('name="password"') ||
    /\botp\b/.test(body)
  );
}

function hasStrongLoggedInSignal(url: string, body: string): boolean {
  const strongBody = [
    'log out',
    'sign out',
    '>logout<',
    'logout</',
    'signout',
    'my account',
    'account settings',
  ];
  if (strongBody.some((h) => body.includes(h))) return true;
  if (url.includes('/dashboard') && body.includes('welcome')) return true;
  return false;
}

/**
 * Update detect state from the latest page signals.
 * Call every poll; then call looksAuthenticated(signals, state).
 */
export function observeLoginSignals(
  signals: LoginDetectSignals,
  state: LoginDetectState,
): LoginDetectState {
  const url = signals.url.toLowerCase();
  const body = signals.bodySnippet.toLowerCase();
  if (hasLoginForm(body) || isSecurityChallenge(url, body)) {
    return { ...state, sawLoginSurface: true };
  }
  return state;
}

/**
 * Returns true only when the page clearly shows a post-login authenticated state.
 * When loginUrl is provided and equals a profile URL, requires prior login surface.
 */
export function looksAuthenticated(
  signals: LoginDetectSignals,
  state?: LoginDetectState,
): boolean {
  const url = signals.url.toLowerCase();
  const body = signals.bodySnippet.toLowerCase();
  const loginPath = signals.loginUrl ? normalizePath(signals.loginUrl) : '';
  const currentPath = normalizePath(signals.url);

  if (isSecurityChallenge(url, body)) return false;
  if (hasLoginForm(body)) return false;

  const onConfiguredLoginSurface =
    Boolean(loginPath) &&
    (currentPath === loginPath ||
      currentPath.startsWith(`${loginPath}/`) ||
      url.includes(loginPath.replace(/^https?:\/\//, '')));

  // Profile-as-login portals (Housing /user-profile): never accept auth until we
  // have observed a login/OTP/challenge surface first in this connect session.
  // This blocks false positives from stale profile HTML / leftover "log out" chrome.
  if (onConfiguredLoginSurface) {
    if (state && !state.sawLoginSurface) return false;
    const cookieOk = typeof signals.cookieCount !== 'number' || signals.cookieCount >= 3;
    return hasStrongLoggedInSignal(url, body) && cookieOk;
  }

  const loginUrlHints = ['/login', '/signin', '/sign-in', '/otp', '/verify'];
  if (loginUrlHints.some((h) => url.includes(h))) return false;

  if (state && !state.sawLoginSurface) {
    // Off login URL but never saw a login form — still require strong signals + cookies.
    const cookieOk = typeof signals.cookieCount !== 'number' || signals.cookieCount >= 3;
    return hasStrongLoggedInSignal(url, body) && cookieOk;
  }

  return hasStrongLoggedInSignal(url, body);
}
