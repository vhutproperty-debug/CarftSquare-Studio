/**
 * AuthEvidenceEngine — single authentication detector for Connect + validate.
 *
 * Primary evidence: cookies + Playwright storageState (local/session storage).
 * Secondary: DOM chrome (logout, profile, avatar) and login-form absence.
 * Never uses URL-based "logged out" heuristics.
 */

import type { Cookie, Page } from 'playwright';
import { getPortalMeta } from '@/lib/research/browser/config';
import { connectorLog } from '@/lib/research/browser/connector-log';

/** Minimum confidence (0–100) to treat session as authenticated / Research Ready. */
export const AUTH_CONFIDENCE_THRESHOLD = 60;

/** Minimum cookies required as a hard gate (storageState primary). */
export const AUTH_COOKIE_HARD_GATE = 2;

export type AuthEvidenceSignal = {
  id: string;
  category: 'cookies' | 'storage' | 'dom' | 'security' | 'settle';
  label: string;
  pass: boolean;
  points: number;
  maxPoints: number;
  detail: string;
};

export type AuthConfidenceBreakdown = {
  cookies: number;
  storage: number;
  dom: number;
  security: number;
  rawTotal: number;
  total: number;
  maxPossible: number;
  threshold: number;
  pass: boolean;
  pointsLost: Array<{ category: string; reason: string; lost: number }>;
};

export type AuthEvidenceResult = {
  authenticated: boolean;
  confidence: number;
  threshold: number;
  signals: AuthEvidenceSignal[];
  breakdown: AuthConfidenceBreakdown;
  summary: string;
  /** Connect poll only — page not ready to score. */
  skipped?: boolean;
  cookieCount: number;
  cookieNames: string[];
  localStorageKeys: string[];
  sessionStorageKeys: string[];
  storageStatePresent: boolean;
  url: string;
  title: string;
  verifyUrl?: string;
};

export type AuthEvidenceSnapshot = {
  url: string;
  title?: string;
  bodyHtml: string;
  cookies: Array<{ name: string }>;
  localStorageKeys?: string[];
  sessionStorageKeys?: string[];
  hasAvatar?: boolean;
  hasAccountName?: boolean;
  hasEditProfile?: boolean;
  hasLogout?: boolean;
  hasProfileLink?: boolean;
  hasLoginForm?: boolean;
  settled?: boolean;
  readyState?: string;
  mode?: 'connect_poll' | 'verify';
  verifyUrl?: string;
  portal?: string;
};

function hasLoginFormInHtml(body: string, explicit?: boolean): boolean {
  if (typeof explicit === 'boolean') return explicit;
  const b = body.toLowerCase();
  return (
    b.includes('enter otp') ||
    b.includes('get otp') ||
    b.includes('verify otp') ||
    b.includes('type="password"') ||
    b.includes('name="password"') ||
    b.includes('sign in with')
  );
}

function hasSecurityWall(title: string, body: string): boolean {
  const t = `${title} ${body}`.toLowerCase();
  return (
    t.includes('security alert') ||
    t.includes('access denied') ||
    t.includes('cf-browser-verification') ||
    t.includes('attention required') ||
    t.includes('verifycaptcha')
  );
}

/**
 * Score authentication from a snapshot. Cookies/storage are primary.
 * No URL substring logout heuristics.
 */
export function scoreAuthEvidence(input: AuthEvidenceSnapshot): AuthEvidenceResult {
  const threshold = AUTH_CONFIDENCE_THRESHOLD;
  const url = input.url || '';
  const title = input.title || '';
  const body = input.bodyHtml || '';
  const cookieNames = (input.cookies || []).map((c) => c.name);
  const cookieCount = cookieNames.length;
  const localKeys = input.localStorageKeys || [];
  const sessionKeys = input.sessionStorageKeys || [];
  const storageStatePresent = localKeys.length > 0 || sessionKeys.length > 0 || cookieCount > 0;

  if (
    input.mode === 'connect_poll' &&
    (input.settled === false || (input.readyState && input.readyState !== 'complete'))
  ) {
    const settleSignal: AuthEvidenceSignal = {
      id: 'page_settled',
      category: 'settle',
      label: 'Page settled',
      pass: false,
      points: 0,
      maxPoints: 0,
      detail: `readyState=${input.readyState ?? 'n/a'} settled=${input.settled}`,
    };
    return {
      authenticated: false,
      confidence: 0,
      threshold,
      signals: [settleSignal],
      breakdown: emptyBreakdown(threshold),
      summary:
        'Authentication score:\nPage settled: FAIL\nDecision: SKIPPED (waiting for readyState=complete + network idle)',
      skipped: true,
      cookieCount,
      cookieNames,
      localStorageKeys: localKeys,
      sessionStorageKeys: sessionKeys,
      storageStatePresent,
      url,
      title,
      verifyUrl: input.verifyUrl,
    };
  }

  const loginForm = hasLoginFormInHtml(body, input.hasLoginForm);
  const security = hasSecurityWall(title, body);
  const logout =
    Boolean(input.hasLogout) || /log\s*out|sign\s*out/.test(body.toLowerCase());
  const editProfile =
    Boolean(input.hasEditProfile) || /edit\s*profile/.test(body.toLowerCase());
  const accountMenu =
    /my\s*account|my\s*profile|account\s*settings|dashboard/.test(body.toLowerCase());
  const avatar =
    Boolean(input.hasAvatar) ||
    /avatar|profile-pic|profilepic|user-menu/.test(body.toLowerCase());
  const accountName = Boolean(input.hasAccountName);
  const profileChrome =
    logout || editProfile || avatar || accountName || accountMenu || Boolean(input.hasProfileLink);

  const signals: AuthEvidenceSignal[] = [
    {
      id: 'cookies_primary',
      category: 'cookies',
      label: 'Cookies (primary)',
      pass: cookieCount >= 3,
      points: cookieCount >= 3 ? 40 : cookieCount >= AUTH_COOKIE_HARD_GATE ? 20 : 0,
      maxPoints: 40,
      detail: `cookieCount=${cookieCount} names=${cookieNames.slice(0, 24).join(',')}`,
    },
    {
      id: 'storage_state',
      category: 'storage',
      label: 'storageState (local/session)',
      pass: localKeys.length > 0 || sessionKeys.length > 0,
      points: localKeys.length > 0 || sessionKeys.length > 0 ? 20 : 0,
      maxPoints: 20,
      detail: `local=${localKeys.length} session=${sessionKeys.length}`,
    },
    {
      id: 'login_form_absent',
      category: 'dom',
      label: 'Login form absent',
      pass: !loginForm,
      points: !loginForm ? 15 : 0,
      maxPoints: 15,
      detail: loginForm ? 'login/OTP/password form present' : 'no login form',
    },
    {
      id: 'auth_dom_chrome',
      category: 'dom',
      label: 'Authenticated DOM chrome',
      pass: profileChrome,
      points: profileChrome ? 15 : 0,
      maxPoints: 15,
      detail: `logout=${logout} editProfile=${editProfile} avatar=${avatar} name=${accountName} menu=${accountMenu}`,
    },
    {
      id: 'security_wall_absent',
      category: 'security',
      label: 'Security wall absent',
      pass: !security,
      points: !security ? 10 : 0,
      maxPoints: 10,
      detail: security ? 'security/captcha wall detected' : 'ok',
    },
  ];

  const breakdown = buildBreakdown(signals, threshold);
  const hardGateFail = cookieCount < AUTH_COOKIE_HARD_GATE;
  const authenticated =
    !hardGateFail && !security && breakdown.pass && !loginForm;

  // If cookies are strong + storage present + no login form, allow pass even with weak DOM
  // (SPAs often hide logout until menu open).
  const storagePrimaryPass =
    !hardGateFail &&
    !security &&
    !loginForm &&
    cookieCount >= 3 &&
    (localKeys.length > 0 || sessionKeys.length > 0 || cookieCount >= 5) &&
    breakdown.total >= Math.min(threshold, 50);

  const finalAuth = authenticated || storagePrimaryPass;
  const confidence = breakdown.total;

  const summary = [
    'Authentication score (AuthEvidenceEngine):',
    `Cookies........${breakdown.cookies}`,
    `Storage........${breakdown.storage}`,
    `DOM............${breakdown.dom}`,
    `Security.......${breakdown.security}`,
    `TOTAL..........${confidence}`,
    `Threshold......${threshold}`,
    hardGateFail ? `Hard gate: FAIL (cookies < ${AUTH_COOKIE_HARD_GATE})` : 'Hard gate: PASS',
    `Decision: ${finalAuth ? 'PASS' : 'FAIL'}`,
    ...breakdown.pointsLost.map((p) => `Lost: ${p.category} -${p.lost} (${p.reason})`),
  ].join('\n');

  return {
    authenticated: finalAuth,
    confidence,
    threshold,
    signals,
    breakdown,
    summary,
    cookieCount,
    cookieNames,
    localStorageKeys: localKeys,
    sessionStorageKeys: sessionKeys,
    storageStatePresent,
    url,
    title,
    verifyUrl: input.verifyUrl,
  };
}

function emptyBreakdown(threshold: number): AuthConfidenceBreakdown {
  return {
    cookies: 0,
    storage: 0,
    dom: 0,
    security: 0,
    rawTotal: 0,
    total: 0,
    maxPossible: 0,
    threshold,
    pass: false,
    pointsLost: [],
  };
}

function buildBreakdown(
  signals: AuthEvidenceSignal[],
  threshold: number,
): AuthConfidenceBreakdown {
  const b = emptyBreakdown(threshold);
  for (const s of signals) {
    b.maxPossible += s.maxPoints;
    if (s.pass) {
      if (s.category === 'cookies') b.cookies += s.points;
      else if (s.category === 'storage') b.storage += s.points;
      else if (s.category === 'dom') b.dom += s.points;
      else if (s.category === 'security') b.security += s.points;
      b.rawTotal += s.points;
    } else if (s.maxPoints > 0) {
      b.pointsLost.push({
        category: s.category,
        reason: `${s.label}: ${s.detail}`,
        lost: s.maxPoints,
      });
    }
  }
  b.total =
    b.maxPossible > 0 ? Math.round((b.rawTotal / b.maxPossible) * 100) : 0;
  b.pass = b.total >= threshold;
  return b;
}

/** Collect storage + cookies from a live page, then score. */
export async function evaluatePageAuth(
  page: Page,
  opts?: {
    portal?: string;
    mode?: 'connect_poll' | 'verify';
    verifyUrl?: string;
    settled?: boolean;
    readyState?: string;
    hasAvatar?: boolean;
    hasAccountName?: boolean;
    hasEditProfile?: boolean;
    hasLogout?: boolean;
    hasProfileLink?: boolean;
    hasLoginForm?: boolean;
  },
): Promise<AuthEvidenceResult> {
  const url = page.url();
  const title = await page.title().catch(() => '');
  const bodyHtml = await page.content().catch(() => '');
  const cookies: Cookie[] = await page.context().cookies().catch(() => []);
  const storage = await page
    .evaluate(() => {
      try {
        return {
          localStorageKeys: Object.keys(localStorage),
          sessionStorageKeys: Object.keys(sessionStorage),
        };
      } catch {
        return { localStorageKeys: [] as string[], sessionStorageKeys: [] as string[] };
      }
    })
    .catch(() => ({ localStorageKeys: [] as string[], sessionStorageKeys: [] as string[] }));

  const result = scoreAuthEvidence({
    portal: opts?.portal,
    url,
    title,
    bodyHtml,
    cookies,
    localStorageKeys: storage.localStorageKeys,
    sessionStorageKeys: storage.sessionStorageKeys,
    mode: opts?.mode || 'verify',
    verifyUrl: opts?.verifyUrl,
    settled: opts?.settled,
    readyState: opts?.readyState,
    hasAvatar: opts?.hasAvatar,
    hasAccountName: opts?.hasAccountName,
    hasEditProfile: opts?.hasEditProfile,
    hasLogout: opts?.hasLogout,
    hasProfileLink: opts?.hasProfileLink,
    hasLoginForm: opts?.hasLoginForm,
  });

  if (opts?.portal) {
    connectorLog(opts.portal, 'auth_evidence_engine', {
      mode: opts.mode || 'verify',
      confidence: result.confidence,
      authenticated: result.authenticated,
      cookieCount: result.cookieCount,
      storageStatePresent: result.storageStatePresent,
      verifyUrl: opts.verifyUrl,
      url,
    });
  }

  return result;
}

/**
 * Navigate to verifyUrl (never loginUrl) on the current page/context and score.
 */
export async function verifyAuthOnPage(
  page: Page,
  portal: string,
  options?: { settleMs?: number },
): Promise<AuthEvidenceResult> {
  const meta = getPortalMeta(portal);
  const verifyUrl = meta?.verifyUrl;
  if (!verifyUrl) {
    throw new Error(`No verifyUrl configured for portal ${portal}`);
  }

  await page.goto(verifyUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => undefined);
  const settleMs = options?.settleMs ?? 4_000;
  if (settleMs > 0) {
    await new Promise((r) => setTimeout(r, settleMs));
  }

  return evaluatePageAuth(page, {
    portal,
    mode: 'verify',
    verifyUrl,
    settled: true,
    readyState: 'complete',
  });
}

/** Resolve verify URL from portal config. */
export function getPortalVerifyUrl(portal: string): string {
  const meta = getPortalMeta(portal);
  if (!meta?.verifyUrl) throw new Error(`No verifyUrl for portal ${portal}`);
  return meta.verifyUrl;
}

export function getPortalLoginUrl(portal: string): string {
  const meta = getPortalMeta(portal);
  if (!meta?.loginUrl) throw new Error(`No loginUrl for portal ${portal}`);
  return meta.loginUrl;
}
