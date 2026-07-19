/**
 * Heuristic login detection for remote connect flows.
 *
 * Conservative on purpose: portal "login" URLs often look like profile/account
 * pages (e.g. Housing → https://housing.com/user-profile). Matching those paths
 * alone must NOT count as authenticated or the worker will capture+close before
 * the user can type credentials.
 */

export type LoginDetectSignals = {
  url: string;
  bodySnippet: string;
  /** Portal login URL the connect flow navigated to. */
  loginUrl?: string;
  cookieCount?: number;
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

function isSecurityChallenge(url: string, body: string): boolean {
  return (
    body.includes('security alert') ||
    body.includes('access denied') ||
    body.includes('attention required') ||
    body.includes('cf-browser-verification') ||
    body.includes('akamai') ||
    /\/_sec\b|\/challenge\b|\/cdn-cgi\b/.test(url)
  );
}

function hasLoginForm(body: string): boolean {
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
    body.includes('otp')
  );
}

function hasStrongLoggedInSignal(url: string, body: string): boolean {
  // Prefer explicit logout / signed-in chrome over bare profile paths.
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

  // URL alone is never enough when it equals/contains the portal login path.
  if (url.includes('/dashboard') && body.includes('welcome')) return true;
  return false;
}

/**
 * Returns true only when the page clearly shows a post-login authenticated state.
 */
export function looksAuthenticated(signals: LoginDetectSignals): boolean {
  const url = signals.url.toLowerCase();
  const body = signals.bodySnippet.toLowerCase();
  const loginPath = signals.loginUrl ? normalizePath(signals.loginUrl) : '';
  const currentPath = normalizePath(signals.url);

  if (isSecurityChallenge(url, body)) return false;
  if (hasLoginForm(body)) return false;

  // Still on (or redirected within) the configured login URL → not done yet
  // unless strong logout chrome is present AND login form is gone.
  const onConfiguredLoginSurface =
    Boolean(loginPath) &&
    (currentPath === loginPath ||
      currentPath.startsWith(`${loginPath}/`) ||
      url.includes(loginPath.replace(/^https?:\/\//, '')));

  if (onConfiguredLoginSurface) {
    // Housing /user-profile is BOTH the login entry and the post-login page.
    // Require strong logout/account chrome + enough cookies before accepting.
    const cookieOk = typeof signals.cookieCount !== 'number' || signals.cookieCount >= 3;
    return hasStrongLoggedInSignal(url, body) && cookieOk;
  }

  const loginUrlHints = ['/login', '/signin', '/sign-in', '/otp', '/verify'];
  if (loginUrlHints.some((h) => url.includes(h))) return false;

  return hasStrongLoggedInSignal(url, body);
}
