/**
 * Reusable Connect authentication engine for all portals EXCEPT Housing.com.
 *
 * Housing keeps the existing Connect path (do not change Housing connector code).
 * MagicBricks, 99acres, NoBroker, Square Yards, and any future portal share this workflow:
 * headed Chromium + LiveView → CAPTCHA wait → chat OTP → verify → capture → validate → Connected.
 */
import type { Page } from 'playwright';
import type { PageAuthProbe } from '@/lib/research/browser-gateway/page-auth-probe';

/** Explicit known portals; engine also applies to any future non-Housing portal. */
export const CONNECT_AUTH_ENGINE_PORTALS = [
  'magicbricks',
  '99acres',
  'nobroker',
  'squareyards',
] as const;

export type ConnectAuthEnginePortal = (typeof CONNECT_AUTH_ENGINE_PORTALS)[number];

export type ConnectAuthChallenge =
  | 'none'
  | 'captcha'
  | 'otp'
  | 'phone'
  | 'waf'
  | 'unknown';

export type ConnectAuthPollResult = {
  authenticated: boolean;
  challenge: ConnectAuthChallenge;
  message: string;
  score: number;
  threshold: number;
  summary: string;
  /** Operator must stay in live view (CAPTCHA / challenge). */
  keepBrowserOpen: boolean;
  /** Ask chat/UI for an OTP code. */
  needsOtpFromUser: boolean;
};

/** True for every connector except Housing.com (Housing stays on its own Connect path). */
export function usesConnectAuthEngine(portal: string): boolean {
  const key = String(portal || '')
    .trim()
    .toLowerCase();
  return Boolean(key) && key !== 'housing';
}

function hasCaptchaOrChallenge(title: string, body: string): boolean {
  const hay = `${title} ${body}`.toLowerCase();
  return /captcha|simplecaptcha|recaptcha|hcaptcha|cf-turnstile|i'?m not a robot|verify you are human|attention required|challenge-platform|verifycaptcha|just a moment|contentsimplecaptcha/i.test(
    hay,
  );
}

function hasHardWaf(title: string, body: string): boolean {
  const hay = `${title} ${body}`.toLowerCase();
  return (
    /access denied|reference\s*#|akamai|edgesuite|security alert|bot.?manager|request blocked/i.test(
      hay,
    ) && !/captcha|recaptcha|hcaptcha|turnstile/i.test(hay)
  );
}

function hasOtpSurface(title: string, body: string, probe?: PageAuthProbe): boolean {
  const hay = `${title} ${body}`.toLowerCase();
  return (
    /enter\s*otp|otp|one[-\s]?time|verification\s*code|verify\s*otp|resend\s*otp/i.test(hay) ||
    Boolean(probe?.hasLoginForm && /otp|code/i.test(hay))
  );
}

/**
 * Classify the current page for the Connect wait loop.
 */
export function classifyConnectAuthPage(input: {
  portal: string;
  title?: string;
  bodySnippet?: string;
  hasLoginForm?: boolean;
  sawLoginSurface: boolean;
  auth: { authenticated: boolean; score: number; threshold: number; summary: string };
}): ConnectAuthPollResult {
  const title = input.title || '';
  const body = input.bodySnippet || '';
  const scored = input.auth;

  if (hasHardWaf(title, body)) {
    return {
      authenticated: false,
      challenge: 'waf',
      message:
        'Portal blocked this login page (security / WAF). Keep the window open or reconnect from a trusted network.',
      score: scored.score,
      threshold: scored.threshold,
      summary: scored.summary,
      keepBrowserOpen: true,
      needsOtpFromUser: false,
    };
  }

  if (hasCaptchaOrChallenge(title, body)) {
    return {
      authenticated: false,
      challenge: 'captcha',
      message:
        'CAPTCHA detected — complete it in the secure LiveView window. The browser will stay open until you finish or the session expires.',
      score: scored.score,
      threshold: scored.threshold,
      summary: scored.summary,
      keepBrowserOpen: true,
      needsOtpFromUser: false,
    };
  }

  if (scored.authenticated) {
    if (!input.sawLoginSurface && usesConnectAuthEngine(input.portal)) {
      return {
        authenticated: false,
        challenge: 'unknown',
        message: 'Waiting for a real login surface before accepting authentication…',
        score: scored.score,
        threshold: scored.threshold,
        summary: scored.summary,
        keepBrowserOpen: true,
        needsOtpFromUser: false,
      };
    }
    return {
      authenticated: true,
      challenge: 'none',
      message: 'Authentication detected — verifying session…',
      score: scored.score,
      threshold: scored.threshold,
      summary: scored.summary,
      keepBrowserOpen: true,
      needsOtpFromUser: false,
    };
  }

  if (
    hasOtpSurface(title, body, {
      hasLoginForm: Boolean(input.hasLoginForm),
    } as PageAuthProbe)
  ) {
    return {
      authenticated: false,
      challenge: 'otp',
      message:
        'OTP required — paste the OTP into Cursor chat (or the Connectors panel). It will be entered automatically.',
      score: scored.score,
      threshold: scored.threshold,
      summary: scored.summary,
      keepBrowserOpen: true,
      needsOtpFromUser: true,
    };
  }

  return {
    authenticated: false,
    challenge: input.sawLoginSurface ? 'phone' : 'none',
    message: input.sawLoginSurface
      ? 'Waiting for login / OTP in the secure browser…'
      : 'Waiting for login page…',
    score: scored.score,
    threshold: scored.threshold,
    summary: scored.summary,
    keepBrowserOpen: true,
    needsOtpFromUser: false,
  };
}

/**
 * Enter OTP into the active Connect page (generic selectors).
 */
export async function applyOtpOnPage(
  page: Page,
  otp: string,
): Promise<{ ok: boolean; filled: boolean; clicked: string | null; detail: string }> {
  const code = String(otp || '').replace(/\D/g, '');
  if (code.length < 4) {
    return { ok: false, filled: false, clicked: null, detail: 'OTP must be at least 4 digits' };
  }

  const otpSelectors = [
    'input[name*="otp" i]',
    'input[id*="otp" i]',
    'input[placeholder*="otp" i]',
    'input[placeholder*="OTP" i]',
    'input[autocomplete="one-time-code"]',
    'input[maxlength="6"]',
    'input[maxlength="4"]',
    'input[type="tel"]',
    'input[type="number"]',
  ];

  let filled = false;
  let used = '';
  for (const sel of otpSelectors) {
    const loc = page.locator(sel).first();
    if ((await loc.count().catch(() => 0)) === 0) continue;
    try {
      await loc.click({ timeout: 2_000 });
      await loc.fill('');
      await loc.type(code, { delay: 40 });
      filled = true;
      used = sel;
      break;
    } catch {
      /* next */
    }
  }

  const submitSelectors = [
    'button:has-text("Verify")',
    'button:has-text("Submit")',
    'button:has-text("Continue")',
    'button:has-text("Confirm")',
    'button:has-text("Login")',
    '[type="submit"]',
  ];
  let clicked: string | null = null;
  for (const sel of submitSelectors) {
    const loc = page.locator(sel).first();
    if ((await loc.count().catch(() => 0)) === 0) continue;
    try {
      await loc.click({ timeout: 2_000 });
      clicked = sel;
      break;
    } catch {
      /* next */
    }
  }

  return {
    ok: filled,
    filled,
    clicked,
    detail: filled
      ? `OTP entered via ${used}${clicked ? `; submitted via ${clicked}` : ''}`
      : 'Could not find an OTP input on the page',
  };
}

export async function applyPhoneOnPage(
  page: Page,
  phone: string,
): Promise<{ ok: boolean; filled: boolean; clicked: string | null; detail: string }> {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length < 10) {
    return { ok: false, filled: false, clicked: null, detail: 'phone must be at least 10 digits' };
  }

  const phoneSelectors = [
    'input[type="tel"]',
    'input[name*="mobile" i]',
    'input[name*="phone" i]',
    'input[id*="mobile" i]',
    'input[id*="phone" i]',
    'input[placeholder*="mobile" i]',
    'input[placeholder*="phone" i]',
    '#signUp-phoneNumber',
    '#emailOrMobile',
    '#mobileNum',
    'input[type="text"]',
  ];

  let filled = false;
  let used = '';
  for (const sel of phoneSelectors) {
    const loc = page.locator(sel).first();
    if ((await loc.count().catch(() => 0)) === 0) continue;
    try {
      await loc.click({ timeout: 2_000 });
      await loc.fill('');
      await loc.type(digits, { delay: 35 });
      filled = true;
      used = sel;
      break;
    } catch {
      /* next */
    }
  }

  const clickSelectors = [
    'button:has-text("Next")',
    'button:has-text("Continue")',
    'button:has-text("Get OTP")',
    'button:has-text("Send OTP")',
    'button:has-text("Login")',
    'a:has-text("Get OTP")',
    '[type="submit"]',
  ];
  let clicked: string | null = null;
  for (const sel of clickSelectors) {
    const loc = page.locator(sel).first();
    if ((await loc.count().catch(() => 0)) === 0) continue;
    try {
      await loc.click({ timeout: 2_000 });
      clicked = sel;
      break;
    } catch {
      /* next */
    }
  }

  return {
    ok: filled,
    filled,
    clicked,
    detail: filled
      ? `Phone entered via ${used}${clicked ? `; clicked ${clicked}` : ''}`
      : 'Could not find a phone input on the page',
  };
}
