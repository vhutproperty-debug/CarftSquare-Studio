/**
 * Authentication evidence collector — evaluates ALL signals independently.
 * Writes per-portal JSON traces. Does not invent auth; reports why detection passed/failed.
 */

import fs from 'fs/promises';
import path from 'path';
import type { Cookie, Page } from 'playwright';
import { LOGIN_CONFIDENCE_THRESHOLD } from '@/connectors/common/connector-lifecycle';
import { getPortalMeta } from '@/lib/research/browser/config';
import { connectorLog } from '@/lib/research/browser/connector-log';

export type AuthSignalEvidence = {
  id: string;
  category:
    | 'cookies'
    | 'storage'
    | 'dom'
    | 'navigation'
    | 'api'
    | 'security'
    | 'pipeline';
  label: string;
  pass: boolean;
  points: number;
  maxPoints: number;
  detail: string;
  selectorOrCookie?: string;
};

export type AuthConfidenceBreakdown = {
  cookies: number;
  profile: number;
  logout: number;
  storage: number;
  api: number;
  navigation: number;
  security: number;
  other: number;
  /** Raw points earned (sum of signal.points). */
  rawTotal: number;
  /** 0–100 normalized confidence. */
  total: number;
  maxPossible: number;
  threshold: number;
  pass: boolean;
  pointsLost: Array<{ category: string; reason: string; lost: number }>;
};

export type AuthFailureReport = {
  whichSignalsFailed: string[];
  whichSelectorsFailed: string[];
  expectedCookies: string[];
  missingCookies: string[];
  localStorageEmpty: boolean;
  sessionStorageEmpty: boolean;
  authenticatedDomExisted: boolean;
  unexpectedRedirect: boolean;
  confidenceDroppedBecause: string;
  firstAuthLossPoint: string;
};

export type PortalAuthTrace = {
  portal: string;
  portalDisplayName: string;
  generatedAt: string;
  phase: string;
  lifecycle: {
    browserLaunched?: boolean;
    persistentProfileRestored?: boolean;
    loginPageOpened?: boolean;
    userCompletedLogin?: boolean | null;
    waitedNetworkIdle?: boolean;
    waitedExtraSettleMs?: number;
  };
  page: {
    url: string;
    title: string;
    httpStatus: number | null;
    screenshotPath: string | null;
    htmlPath: string | null;
    htmlLength: number;
  };
  cookies: {
    count: number;
    names: string[];
    beforeEncryptionCount?: number;
    afterEncryptionBytes?: number;
    restoredCount?: number;
  };
  storage: {
    localStorageKeys: string[];
    sessionStorageKeys: string[];
    localStorageEmpty: boolean;
    sessionStorageEmpty: boolean;
    storageRestored?: boolean | null;
  };
  signals: AuthSignalEvidence[];
  confidence: AuthConfidenceBreakdown;
  failureReport: AuthFailureReport | null;
  sessionSave?: {
    mongoOk?: boolean | null;
    cookiesEncryptedBytes?: number;
    storageEncryptedBytes?: number;
    profileDirectory?: string | null;
    note?: string;
  };
  sessionRestore?: {
    cookiesRestored: boolean;
    storageRestored: boolean;
    cookieCount: number;
    profileRestored: boolean | null;
    urlAfterRestore: string;
    loginConfidence: number;
  } | null;
  pipelineNotes: string[];
  rootCauseHypothesis: string | null;
};

const EXPECTED_AUTH_COOKIE_HINTS: Record<string, string[]> = {
  housing: ['session', 'token', 'auth', 'user', 'login'],
  magicbricks: [
    'session',
    'token',
    'auth',
    'user',
    'login',
    'mb',
    'acegi',
    'useruniq',
    'usercookie',
  ],
  '99acres': ['session', 'token', 'auth', 'user', 'login'],
  nobroker: ['session', 'token', 'auth', 'user', 'login', 'nb'],
  squareyards: ['session', 'token', 'auth', 'user', 'login'],
};

function categoryFor(id: string): AuthConfidenceBreakdown['pointsLost'][0]['category'] {
  if (id.includes('cookie')) return 'cookies';
  if (id.includes('storage') || id.includes('local') || id.includes('session_storage'))
    return 'storage';
  if (id.includes('logout')) return 'logout';
  if (id.includes('avatar') || id.includes('profile') || id.includes('account') || id.includes('name'))
    return 'profile';
  if (id.includes('api')) return 'api';
  if (id.includes('url') || id.includes('redirect') || id.includes('nav')) return 'navigation';
  if (id.includes('security') || id.includes('wall')) return 'security';
  return 'other';
}

/** Score all signals; never short-circuit mid-evaluation. */
export function scoreAuthEvidence(
  signals: AuthSignalEvidence[],
  threshold = LOGIN_CONFIDENCE_THRESHOLD,
): AuthConfidenceBreakdown {
  const buckets: AuthConfidenceBreakdown = {
    cookies: 0,
    profile: 0,
    logout: 0,
    storage: 0,
    api: 0,
    navigation: 0,
    security: 0,
    other: 0,
    rawTotal: 0,
    total: 0,
    maxPossible: 0,
    threshold,
    pass: false,
    pointsLost: [],
  };

  for (const s of signals) {
    const cat = categoryFor(s.id) as keyof Pick<
      AuthConfidenceBreakdown,
      'cookies' | 'profile' | 'logout' | 'storage' | 'api' | 'navigation' | 'security' | 'other'
    >;
    buckets.maxPossible += s.maxPoints;
    if (s.pass) {
      buckets[cat] += s.points;
      buckets.rawTotal += s.points;
    } else if (s.maxPoints > 0) {
      buckets.pointsLost.push({
        category: cat,
        reason: `${s.label}: ${s.detail}`,
        lost: s.maxPoints,
      });
    }
  }

  buckets.total =
    buckets.maxPossible > 0
      ? Math.round((buckets.rawTotal / buckets.maxPossible) * 100)
      : 0;
  buckets.pass = buckets.total >= threshold;
  return buckets;
}

export async function collectPageAuthEvidence(
  page: Page,
  input: {
    portal: string;
    phase: string;
    httpStatus?: number | null;
    loginUrl?: string;
    waitedExtraSettleMs?: number;
    screenshotDir?: string;
  },
): Promise<PortalAuthTrace> {
  const portal = input.portal;
  const meta = getPortalMeta(portal);
  const loginUrl = input.loginUrl || meta?.loginUrl || '';

  // Extra settle for post-login races (3–5s) when requested.
  if (input.waitedExtraSettleMs && input.waitedExtraSettleMs > 0) {
    await new Promise((r) => setTimeout(r, input.waitedExtraSettleMs));
  }

  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => undefined);

  const url = page.url();
  const title = await page.title().catch(() => '');
  const html = await page.content().catch(() => '');
  const body = html.toLowerCase();

  const cookies: Cookie[] = await page.context().cookies().catch(() => []);
  const cookieNames = cookies.map((c) => c.name);

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

  const artifactDir =
    input.screenshotDir ||
    path.join(process.cwd(), 'tmp', 'auth-traces', portal);
  await fs.mkdir(artifactDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const screenshotPath = path.join(artifactDir, `${stamp}.jpg`);
  const htmlPath = path.join(artifactDir, `${stamp}.html`);
  await page.screenshot({ path: screenshotPath, type: 'jpeg', quality: 60 }).catch(() => undefined);
  await fs.writeFile(htmlPath, html, 'utf8').catch(() => undefined);

  // DOM probes — evaluate independently (never stop at first miss).
  const dom = await page
    .evaluate(() => {
      const text = (document.body?.innerText || '').toLowerCase();
      const htmlLower = (document.documentElement?.outerHTML || '').toLowerCase();
      const has = (re: RegExp) => re.test(text) || re.test(htmlLower);
      return {
        logout: has(/log\s*out|sign\s*out/),
        editProfile: has(/edit\s*profile/),
        accountMenu: has(/my\s*account|my\s*profile|account\s*settings|dashboard/),
        avatar: Boolean(
          document.querySelector(
            'img[alt*="avatar" i], img[alt*="profile" i], [class*="avatar"], [class*="profile-pic"], [class*="profilePic"]',
          ),
        ),
        userName: Boolean(
          document.querySelector(
            '[class*="user-name"], [class*="username"], [data-testid*="user-name"], [class*="account-name"]',
          ),
        ),
        loginForm: Boolean(
          document.querySelector('input[type="password"], input[name="password"]') ||
            /enter otp|get otp|sign in with/i.test(text),
        ),
        authenticatedNav: has(/my\s*shortlist|saved\s*searches|post\s*property|owner\s*dashboard/),
      };
    })
    .catch(() => ({
      logout: false,
      editProfile: false,
      accountMenu: false,
      avatar: false,
      userName: false,
      loginForm: true,
      authenticatedNav: false,
    }));

  const urlLower = url.toLowerCase();
  // Intentionally unused for pass/fail — verifyUrl must never be scored via URL login heuristics.
  void urlLower;

  const expectedHints = EXPECTED_AUTH_COOKIE_HINTS[portal] || ['session', 'auth', 'token'];
  const matchingCookieHints = cookieNames.filter((n) =>
    expectedHints.some((h) => n.toLowerCase().includes(h)),
  );
  const missingHints = expectedHints.filter(
    (h) => !cookieNames.some((n) => n.toLowerCase().includes(h)),
  );

  const signals: AuthSignalEvidence[] = [
    {
      id: 'auth_cookies_count',
      category: 'cookies',
      label: 'Auth cookies (count ≥ 3)',
      pass: cookies.length >= 3,
      points: cookies.length >= 3 ? 40 : 0,
      maxPoints: 40,
      detail: `cookieCount=${cookies.length} names=${cookieNames.slice(0, 20).join(',')}`,
    },
    {
      id: 'auth_cookie_name_hints',
      category: 'cookies',
      label: 'Cookie name hints (session/auth/token)',
      pass: matchingCookieHints.length > 0,
      points: 0,
      maxPoints: 0,
      detail:
        matchingCookieHints.length > 0
          ? `matched=${matchingCookieHints.join(',')}`
          : `missingHints=${missingHints.join(',')}`,
      selectorOrCookie: expectedHints.join('|'),
    },
    {
      id: 'local_storage',
      category: 'storage',
      label: 'LocalStorage keys',
      pass: storage.localStorageKeys.length > 0,
      points: storage.localStorageKeys.length > 0 ? 5 : 0,
      maxPoints: 5,
      detail: `keys=${storage.localStorageKeys.slice(0, 30).join(',') || '(empty)'}`,
    },
    {
      id: 'session_storage',
      category: 'storage',
      label: 'SessionStorage keys',
      pass: storage.sessionStorageKeys.length > 0,
      points: storage.sessionStorageKeys.length > 0 ? 5 : 0,
      maxPoints: 5,
      detail: `keys=${storage.sessionStorageKeys.slice(0, 30).join(',') || '(empty)'}`,
    },
    {
      id: 'profile_avatar',
      category: 'dom',
      label: 'Profile avatar',
      pass: dom.avatar,
      points: dom.avatar ? 10 : 0,
      maxPoints: 10,
      detail: dom.avatar ? 'avatar selector matched' : 'no avatar selector match',
      selectorOrCookie:
        'img[alt*=avatar], [class*=avatar], [class*=profile-pic]',
    },
    {
      id: 'account_menu',
      category: 'dom',
      label: 'Account menu',
      pass: dom.accountMenu,
      points: dom.accountMenu ? 10 : 0,
      maxPoints: 10,
      detail: dom.accountMenu ? 'account menu text found' : 'no account menu text',
    },
    {
      id: 'logout_button',
      category: 'dom',
      label: 'Logout button',
      pass: dom.logout,
      points: dom.logout ? 20 : 0,
      maxPoints: 20,
      detail: dom.logout ? 'logout/sign out found' : 'logout control missing',
      selectorOrCookie: 'text: log out|sign out OR a[href*=logout]',
    },
    {
      id: 'user_name',
      category: 'dom',
      label: 'User name',
      pass: dom.userName,
      points: dom.userName ? 10 : 0,
      maxPoints: 10,
      detail: dom.userName ? 'user-name chrome found' : 'user-name chrome missing',
    },
    {
      id: 'authenticated_nav',
      category: 'dom',
      label: 'Authenticated navigation',
      pass: dom.authenticatedNav,
      points: dom.authenticatedNav ? 5 : 0,
      maxPoints: 5,
      detail: dom.authenticatedNav ? 'auth nav found' : 'auth nav missing',
    },
    {
      id: 'portal_edit_profile',
      category: 'dom',
      label: 'Portal-specific authenticated DOM (edit profile)',
      pass: dom.editProfile,
      points: dom.editProfile ? 10 : 0,
      maxPoints: 10,
      detail: dom.editProfile ? 'edit profile found' : 'edit profile missing',
    },
    {
      id: 'login_form_absent',
      category: 'dom',
      label: 'Login form absent',
      pass: !dom.loginForm,
      points: !dom.loginForm ? 15 : 0,
      maxPoints: 15,
      detail: dom.loginForm ? 'login/OTP/password form visible' : 'no login form',
    },
    {
      id: 'verify_url_target',
      category: 'pipeline',
      label: 'Verification uses verifyUrl (not loginUrl)',
      pass: Boolean(meta?.verifyUrl),
      points: 0,
      maxPoints: 0,
      detail: `verifyUrl=${meta?.verifyUrl || 'n/a'} loginUrl=${loginUrl} finalUrl=${url}`,
    },
    {
      id: 'authenticated_api',
      category: 'api',
      label: 'Authenticated API response',
      pass: false,
      points: 0,
      maxPoints: 10,
      detail: 'Not probed — no portal auth API wired in detector yet',
    },
    {
      id: 'security_wall_absent',
      category: 'security',
      label: 'Security wall absent',
      pass: !/access denied|security alert|cf-browser-verification|attention required/i.test(
        `${title} ${body}`,
      ),
      points: !/access denied|security alert|cf-browser-verification|attention required/i.test(
        `${title} ${body}`,
      )
        ? 10
        : 0,
      maxPoints: 10,
      detail: 'title+body scan',
    },
  ];

  const confidence = scoreAuthEvidence(signals);
  const authenticatedDom =
    dom.logout || dom.editProfile || dom.avatar || dom.accountMenu || dom.userName;

  let firstAuthLossPoint = 'none';
  if (!confidence.pass) {
    const firstFail = signals.find((s) => !s.pass && s.maxPoints > 0);
    firstAuthLossPoint = firstFail
      ? `confidence: ${firstFail.id} failed (${firstFail.detail})`
      : 'confidence below threshold';
  }

  const failureReport: AuthFailureReport | null = confidence.pass
    ? null
    : {
        whichSignalsFailed: signals.filter((s) => !s.pass).map((s) => s.id),
        whichSelectorsFailed: signals
          .filter((s) => !s.pass && s.selectorOrCookie && s.category === 'dom')
          .map((s) => `${s.id}:${s.selectorOrCookie}`),
        expectedCookies: expectedHints,
        missingCookies: missingHints,
        localStorageEmpty: storage.localStorageKeys.length === 0,
        sessionStorageEmpty: storage.sessionStorageKeys.length === 0,
        authenticatedDomExisted: authenticatedDom,
        unexpectedRedirect: Boolean(meta?.verifyUrl) && !url.startsWith((meta?.verifyUrl || '').split('?')[0]),
        confidenceDroppedBecause: confidence.pointsLost
          .map((p) => `${p.category}: -${p.lost} (${p.reason})`)
          .join('; '),
        firstAuthLossPoint,
      };

  const pipelineNotes: string[] = [
    'AuthEvidenceEngine is the single detector (cookies/storageState primary).',
    'validateSession navigates to verifyUrl — never loginUrl.',
    'Connect verifies on the same browser context before persisting storageState.',
  ];

  let rootCauseHypothesis: string | null = null;
  if (!confidence.pass && cookies.length < 3) {
    rootCauseHypothesis =
      'Cookie/storageState restore may have failed or capture was empty.';
  } else if (!confidence.pass) {
    rootCauseHypothesis = firstAuthLossPoint;
  }

  const trace: PortalAuthTrace = {
    portal,
    portalDisplayName: meta?.displayName || portal,
    generatedAt: new Date().toISOString(),
    phase: input.phase,
    lifecycle: {
      browserLaunched: true,
      persistentProfileRestored: true,
      loginPageOpened: true,
      userCompletedLogin: null,
      waitedNetworkIdle: true,
      waitedExtraSettleMs: input.waitedExtraSettleMs ?? 0,
    },
    page: {
      url,
      title,
      httpStatus: input.httpStatus ?? null,
      screenshotPath,
      htmlPath,
      htmlLength: html.length,
    },
    cookies: {
      count: cookies.length,
      names: cookieNames,
    },
    storage: {
      localStorageKeys: storage.localStorageKeys,
      sessionStorageKeys: storage.sessionStorageKeys,
      localStorageEmpty: storage.localStorageKeys.length === 0,
      sessionStorageEmpty: storage.sessionStorageKeys.length === 0,
    },
    signals,
    confidence,
    failureReport,
    sessionRestore: null,
    pipelineNotes,
    rootCauseHypothesis,
  };

  connectorLog(portal, 'auth_evidence', {
    phase: input.phase,
    confidence: confidence.total,
    pass: confidence.pass,
    firstAuthLossPoint,
    cookieCount: cookies.length,
    url,
  });

  return trace;
}

export async function writePortalAuthTrace(
  trace: PortalAuthTrace,
  outDir = path.join(process.cwd(), 'tmp', 'auth-traces'),
): Promise<string> {
  await fs.mkdir(outDir, { recursive: true });
  const fileName = `${trace.portalDisplayName.replace(/\s+/g, '')}-auth-trace.json`;
  // Normalize portal file names to the requested deliverable names.
  const alias: Record<string, string> = {
    housing: 'Housing-auth-trace.json',
    magicbricks: 'MagicBricks-auth-trace.json',
    '99acres': '99acres-auth-trace.json',
    nobroker: 'NoBroker-auth-trace.json',
    squareyards: 'SquareYards-auth-trace.json',
  };
  const target = path.join(outDir, alias[trace.portal] || fileName);
  await fs.writeFile(target, JSON.stringify(trace, null, 2), 'utf8');
  return target;
}

/**
 * Static evidence (no browser): proves looksLoggedOut short-circuit on each portal loginUrl.
 */
export function buildStaticAuthLossTrace(portal: string): PortalAuthTrace {
  const meta = getPortalMeta(portal);
  const loginUrl = meta?.loginUrl || '';
  const urlLower = loginUrl.toLowerCase();
  const urlLooksLogin =
    /login|sign[\s-]?in|otp|password|verify/.test(urlLower) && !/profile/.test(urlLower);

  const signals: AuthSignalEvidence[] = [
    {
      id: 'looks_logged_out_on_login_url',
      category: 'pipeline',
      label: 'looksLoggedOut(loginUrl)',
      pass: !urlLooksLogin,
      points: 0,
      maxPoints: 0,
      detail: urlLooksLogin
        ? `TRUE — URL "${loginUrl}" matches login heuristic → validateSession returns needs_login before confidence scoring`
        : `FALSE — URL "${loginUrl}" does not trip looksLoggedOut by URL alone`,
    },
    {
      id: 'dual_detector',
      category: 'pipeline',
      label: 'Dual detector systems',
      pass: false,
      points: 0,
      maxPoints: 0,
      detail:
        'Connect: login-detect.ts (threshold 6). Validate: login-confidence.ts (threshold 60%). Different signals and thresholds.',
    },
    {
      id: 'browser_closed_before_validate',
      category: 'pipeline',
      label: 'Browser closed before validate',
      pass: false,
      points: 0,
      maxPoints: 0,
      detail:
        'worker-runtime closes Connect Chromium and deletes connect profile, then opens a new automation context and re-navigates to loginUrl.',
    },
  ];

  const confidence = scoreAuthEvidence(signals);
  const firstAuthLossPoint = urlLooksLogin
    ? 'looksLoggedOut: validateSession navigates to loginUrl containing "login"'
    : portal === 'housing'
      ? 'Housing loginUrl is /user-profile (URL heuristic OK) — if needs_login, loss is later (confidence DOM / restore)'
      : portal === '99acres'
        ? '99acres loginUrl is homepage (URL heuristic OK) — if needs_login, loss is later (confidence DOM / captcha / restore)'
        : 'unknown';

  return {
    portal,
    portalDisplayName: meta?.displayName || portal,
    generatedAt: new Date().toISOString(),
    phase: 'static_pipeline_analysis',
    lifecycle: {
      browserLaunched: false,
      persistentProfileRestored: false,
      loginPageOpened: false,
      userCompletedLogin: null,
      waitedNetworkIdle: false,
      waitedExtraSettleMs: 0,
    },
    page: {
      url: loginUrl,
      title: '(static analysis — no live page)',
      httpStatus: null,
      screenshotPath: null,
      htmlPath: null,
      htmlLength: 0,
    },
    cookies: { count: 0, names: [] },
    storage: {
      localStorageKeys: [],
      sessionStorageKeys: [],
      localStorageEmpty: true,
      sessionStorageEmpty: true,
    },
    signals,
    confidence,
    failureReport: {
      whichSignalsFailed: signals.filter((s) => !s.pass).map((s) => s.id),
      whichSelectorsFailed: [],
      expectedCookies: EXPECTED_AUTH_COOKIE_HINTS[portal] || [],
      missingCookies: [],
      localStorageEmpty: true,
      sessionStorageEmpty: true,
      authenticatedDomExisted: false,
      unexpectedRedirect: false,
      confidenceDroppedBecause: firstAuthLossPoint,
      firstAuthLossPoint,
    },
    sessionRestore: null,
    pipelineNotes: [
      'Evidence source: code path in lib/research/sessions/browser-session-manager.ts looksLoggedOut()',
      'Evidence source: worker-runtime.ts stores sessionStatus=needs_login then validateSession()',
      'Evidence source: RESEARCH_PORTALS loginUrl config',
      `Portal loginUrl: ${loginUrl}`,
      `urlLooksLogin=${urlLooksLogin}`,
    ],
    rootCauseHypothesis: urlLooksLogin
      ? 'ROOT CAUSE (evidence): looksLoggedOut short-circuit on loginUrl during post-Connect validateSession.'
      : 'URL short-circuit not the primary cause for this portal; inspect live confidence / restore traces.',
  };
}
