/**
 * @deprecated Import from `@/lib/research/auth-detection/auth-evidence-engine`.
 * Thin compatibility shim — Connect wait + tests still import these names.
 */

import {
  AUTH_CONFIDENCE_THRESHOLD,
  scoreAuthEvidence,
  type AuthEvidenceResult,
  type AuthEvidenceSignal,
  type AuthEvidenceSnapshot,
} from '@/lib/research/auth-detection/auth-evidence-engine';

export type LoginDetectSignals = {
  url: string;
  bodySnippet: string;
  loginUrl?: string;
  cookieCount?: number;
  readyState?: string;
  title?: string;
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
  localStorageKeys?: string[];
  sessionStorageKeys?: string[];
  cookieNames?: string[];
};

export type LoginDetectState = {
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
  skipped?: boolean;
  confidence?: number;
};

/** @deprecated Use AUTH_CONFIDENCE_THRESHOLD (0–100). Kept as alias for tests. */
export const AUTH_SCORE_THRESHOLD = AUTH_CONFIDENCE_THRESHOLD;

export function isSecurityChallenge(url: string, body: string): boolean {
  const t = `${url} ${body}`.toLowerCase();
  return (
    t.includes('security alert') ||
    t.includes('access denied') ||
    t.includes('attention required') ||
    t.includes('cf-browser-verification') ||
    t.includes('akamai')
  );
}

export function hasLoginForm(body: string): boolean {
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
  const body = signals.bodySnippet.toLowerCase();
  if (signals.hasLoginForm === true || hasLoginForm(body) || isSecurityChallenge(signals.url, body)) {
    return { ...state, sawLoginSurface: true };
  }
  return state;
}

/**
 * Maps pageSignals → AuthEvidenceEngine. No URL logout heuristics.
 */
export function scoreAuthentication(
  signals: LoginDetectSignals,
  _state?: LoginDetectState,
): AuthScoreResult {
  const cookieNames =
    signals.cookieNames ||
    Array.from({ length: Number(signals.cookieCount || 0) }, (_, i) => `cookie_${i}`);

  const snapshot: AuthEvidenceSnapshot = {
    url: signals.url,
    title: signals.title,
    bodyHtml: signals.bodySnippet || '',
    cookies: cookieNames.map((name) => ({ name })),
    localStorageKeys: signals.localStorageKeys,
    sessionStorageKeys: signals.sessionStorageKeys,
    hasAvatar: signals.hasAvatar,
    hasAccountName: signals.hasAccountName,
    hasEditProfile: signals.hasEditProfile,
    hasLogout: signals.hasLogout,
    hasProfileLink: signals.hasProfileLink,
    hasLoginForm: signals.hasLoginForm,
    settled: signals.settled,
    readyState: signals.readyState,
    mode: 'connect_poll',
  };

  const result = scoreAuthEvidence(snapshot);
  return toLegacyScore(result);
}

function toLegacyScore(result: AuthEvidenceResult): AuthScoreResult {
  const signals: AuthSignalScore[] = result.signals.map((s: AuthEvidenceSignal) => ({
    name: s.label,
    pass: s.pass,
    weight: s.maxPoints,
    detail: s.detail,
  }));
  return {
    authenticated: result.authenticated,
    score: result.confidence,
    threshold: result.threshold,
    signals,
    summary: result.summary,
    skipped: result.skipped,
    confidence: result.confidence,
  };
}

export function looksAuthenticated(
  signals: LoginDetectSignals,
  state?: LoginDetectState,
): boolean {
  return scoreAuthentication(signals, state).authenticated;
}

export function formatScoreSummary(
  signals: AuthSignalScore[],
  score: number,
  authenticated: boolean,
): string {
  return [
    'Authentication score:',
    ...signals.map(
      (s) =>
        `${s.name}: ${s.pass ? 'PASS' : 'FAIL'}${s.detail ? ` (${s.detail})` : ''} [+${s.weight}]`,
    ),
    `Total: ${score}`,
    `Decision: ${authenticated ? 'AUTHENTICATED' : 'NOT AUTHENTICATED'}`,
  ].join('\n');
}
