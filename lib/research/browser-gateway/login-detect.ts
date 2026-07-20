/**
 * Weighted authentication detector for remote Connect login-wait.
 *
 * Does NOT rely solely on URL matching. Housing uses /user-profile for both
 * login entry and authenticated profile — score DOM + cookies instead.
 */

export type LoginDetectSignals = {
  url: string;
  bodySnippet: string;
  loginUrl?: string;
  cookieCount?: number;
  readyState?: string;
  title?: string;
  /** False until readyState=complete and network idle window satisfied. */
  settled?: boolean;
  networkIdleMs?: number;
  iframeCount?: number;
  shadowHostCount?: number;
  hasAvatar?: boolean;
  hasAccountName?: boolean;
  hasEditProfile?: boolean;
  hasLogout?: boolean;
  hasProfileLink?: boolean;
  hasLoginForm?: boolean;
  profileSelectors?: string[];
  attemptedSelectors?: string[];
  evaluateError?: string;
};

export type LoginDetectState = {
  /** True after we have seen a login/OTP/security-challenge surface this session. */
  sawLoginSurface: boolean;
};

export type AuthSignalScore = {
  name: string;
  pass: boolean;
  weight: number;
  detail?: string;
};

export type AuthScoreResult = {
  authenticated: boolean;
  score: number;
  threshold: number;
  signals: AuthSignalScore[];
  summary: string;
  /** True when page was not settled — caller should keep polling. */
  skipped?: boolean;
};

/** Minimum weighted score to treat the page as authenticated. */
export const AUTH_SCORE_THRESHOLD = 6;

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
  // Avoid bare "otp" — Housing profile bundles often contain that token in scripts.
  return (
    body.includes('enter otp') ||
    body.includes('enter password') ||
    body.includes('sign in') ||
    body.includes('log in') ||
    body.includes('login with') ||
    body.includes('get otp') ||
    body.includes('request otp') ||
    body.includes('verify otp') ||
    body.includes('type="password"') ||
    body.includes('name="password"')
  );
}

export function observeLoginSignals(
  signals: LoginDetectSignals,
  state: LoginDetectState,
): LoginDetectState {
  const url = signals.url.toLowerCase();
  const body = signals.bodySnippet.toLowerCase();
  if (
    signals.hasLoginForm === true ||
    hasLoginForm(body) ||
    isSecurityChallenge(url, body)
  ) {
    return { ...state, sawLoginSurface: true };
  }
  return state;
}

/**
 * Weighted auth score. Call every poll; log `summary` for PASS/FAIL breakdown.
 */
export function scoreAuthentication(
  signals: LoginDetectSignals,
  _state?: LoginDetectState,
): AuthScoreResult {
  const url = signals.url.toLowerCase();
  const body = (signals.bodySnippet || '').toLowerCase();
  const cookieCount = Number(signals.cookieCount || 0);

  // Do not score until the page has settled (readyState complete + network idle).
  if (signals.settled === false || (signals.readyState && signals.readyState !== 'complete')) {
    const skippedSignals: AuthSignalScore[] = [
      {
        name: 'Page settled',
        pass: false,
        weight: 0,
        detail: `readyState=${signals.readyState ?? 'n/a'} settled=${signals.settled} networkIdleMs=${signals.networkIdleMs ?? 0}`,
      },
    ];
    return {
      authenticated: false,
      score: 0,
      threshold: AUTH_SCORE_THRESHOLD,
      signals: skippedSignals,
      skipped: true,
      summary: [
        'Authentication score:',
        `Page settled: FAIL (${skippedSignals[0].detail})`,
        'Decision: SKIPPED (waiting for readyState=complete and network idle)',
      ].join('\n'),
    };
  }

  if (isSecurityChallenge(url, body)) {
    const signalsOut: AuthSignalScore[] = [
      { name: 'Security challenge absent', pass: false, weight: 0, detail: 'blocked' },
    ];
    return {
      authenticated: false,
      score: 0,
      threshold: AUTH_SCORE_THRESHOLD,
      signals: signalsOut,
      summary: formatScoreSummary(signalsOut, 0, false),
    };
  }

  // Prefer explicit DOM probe; fallback to HTML heuristics only when probe omitted.
  const loginFormPresent =
    typeof signals.hasLoginForm === 'boolean'
      ? signals.hasLoginForm
      : hasLoginForm(body);

  let pathHint = '';
  try {
    pathHint = new URL(signals.url).pathname.toLowerCase();
  } catch {
    pathHint = url;
  }
  const onUserProfile =
    url.includes('/user-profile') ||
    url.includes('/userprofile') ||
    (signals.loginUrl
      ? normalizePath(signals.url) === normalizePath(signals.loginUrl)
      : false) ||
    /\/(profile|myaccount|account)(\/|$)/.test(pathHint);

  const hasAvatar = Boolean(signals.hasAvatar);
  const hasAccountName = Boolean(signals.hasAccountName);
  const hasEditProfile =
    Boolean(signals.hasEditProfile) || /edit\s*profile|update\s*profile/.test(body);
  const hasLogout =
    Boolean(signals.hasLogout) ||
    body.includes('log out') ||
    body.includes('sign out') ||
    body.includes('>logout<');
  const hasProfileLink = Boolean(signals.hasProfileLink);
  const cookiesOk = cookieCount >= 3;
  const loginFormAbsent = !loginFormPresent;

  // Strong DOM evidence of an authenticated profile shell.
  const strongProfileDom =
    (hasAvatar && hasAccountName) ||
    (hasEditProfile && (hasAvatar || hasAccountName)) ||
    (hasLogout && (hasAvatar || hasAccountName || hasEditProfile));

  // Any two distinct profile DOM signals (common when already logged-in on /user-profile).
  const profileDomCount = [
    hasAvatar,
    hasAccountName,
    hasEditProfile,
    hasLogout || hasProfileLink,
  ].filter(Boolean).length;
  const multiProfileDom = profileDomCount >= 2;

  const scored: AuthSignalScore[] = [
    { name: 'URL', pass: onUserProfile, weight: 1, detail: signals.url },
    { name: 'Avatar', pass: hasAvatar, weight: 2 },
    { name: 'Profile name', pass: hasAccountName, weight: 2 },
    { name: 'Edit profile', pass: hasEditProfile, weight: 2 },
    { name: 'Logout/profile link', pass: hasLogout || hasProfileLink, weight: 1 },
    { name: 'Login form absent', pass: loginFormAbsent, weight: 2 },
    {
      name: 'Cookies',
      pass: cookiesOk,
      weight: 2,
      detail: `count=${cookieCount}`,
    },
  ];

  const score = scored.reduce((sum, s) => sum + (s.pass ? s.weight : 0), 0);

  // Hard veto: visible login/OTP form means not done, regardless of score.
  // Profile route + cookies + no login form + multi DOM signals is enough when
  // the browser is already authenticated (never shows a login form this session).
  const authenticated =
    loginFormAbsent &&
    (score >= AUTH_SCORE_THRESHOLD ||
      (onUserProfile && cookiesOk && strongProfileDom) ||
      (onUserProfile && cookiesOk && multiProfileDom));

  return {
    authenticated,
    score,
    threshold: AUTH_SCORE_THRESHOLD,
    signals: scored,
    summary: formatScoreSummary(scored, score, authenticated),
  };
}

export function formatScoreSummary(
  signals: AuthSignalScore[],
  score: number,
  authenticated: boolean,
): string {
  const lines = [
    'Authentication score:',
    ...signals.map(
      (s) =>
        `${s.name}: ${s.pass ? 'PASS' : 'FAIL'}${s.detail ? ` (${s.detail})` : ''} [+${s.weight}]`,
    ),
    `Total: ${score}`,
    `Decision: ${authenticated ? 'AUTHENTICATED' : 'NOT AUTHENTICATED'}`,
  ];
  return lines.join('\n');
}

/** Back-compat boolean helper used by older call sites. */
export function looksAuthenticated(
  signals: LoginDetectSignals,
  state?: LoginDetectState,
): boolean {
  return scoreAuthentication(signals, state).authenticated;
}
