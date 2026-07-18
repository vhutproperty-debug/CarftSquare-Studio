/**
 * Heuristic login detection for remote connect flows.
 * Conservative: requires leaving login surfaces and observing authenticated signals.
 */
export function looksAuthenticated(signals: { url: string; bodySnippet: string }): boolean {
  const url = signals.url.toLowerCase();
  const body = signals.bodySnippet.toLowerCase();

  const loginUrlHints = ['/login', '/signin', '/sign-in', '/otp', '/verify', 'auth'];
  const onLoginPage = loginUrlHints.some((h) => url.includes(h));

  const loggedInHints = [
    'logout',
    'log out',
    'sign out',
    'my profile',
    'dashboard',
    'account settings',
    'user-profile',
    'my account',
  ];
  const hasLoggedInSignal = loggedInHints.some((h) => body.includes(h) || url.includes(h));

  if (onLoginPage && !hasLoggedInSignal) return false;
  if (hasLoggedInSignal && !onLoginPage) return true;

  // Profile/account URLs without OTP/password prompts
  if (
    (url.includes('profile') || url.includes('account') || url.includes('dashboard')) &&
    !body.includes('enter otp') &&
    !body.includes('enter password') &&
    !body.includes('sign in')
  ) {
    return true;
  }

  return false;
}
