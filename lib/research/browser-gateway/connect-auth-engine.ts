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

/**
 * Active CAPTCHA challenge — must reflect *visible* challenge UI, not residual
 * script/CDN strings alone. MagicBricks keeps `contentsimpleCaptcha` in script
 * URLs after solve (those must NOT block verify), but a live `<img src*="captcha">`
 * on the phone step MUST keep challenge=captcha so the cross-host verify probe
 * does not navigate to www and trip Akamai Access Denied mid-login.
 */
function hasCaptchaOrChallenge(title: string, body: string): boolean {
  const hay = `${title} ${body}`.toLowerCase();
  // Hard challenge walls (Cloudflare / Akamai interstitial) — title-level only.
  if (
    /attention required|just a moment|i'?m not a robot|verify you are human|cf-turnstile|challenge-platform/i.test(
      title,
    )
  ) {
    return true;
  }
  // Visible captcha image — src/alt *or* MagicBricks id=captchaImageSignIn
  // (image URL often has no "captcha" substring; id is the reliable signal).
  if (
    /<img\b[^>]+(?:src|alt|id|class)=['"][^'"]*captcha/i.test(body) ||
    /id=["']captchaimagesignin["']/i.test(body)
  ) {
    return true;
  }
  // MagicBricks contenteditable captcha field (NOT an <input>).
  if (
    /id=["']captchacodesignin["']/i.test(body) ||
    /signup__captcha--input/i.test(body) ||
    /contenteditable=["']true["'][^>]*name=["'][^"']*captcha/i.test(body) ||
    /name=["'][^"']*captcha[^"']*["'][^>]*contenteditable/i.test(body)
  ) {
    return true;
  }
  // Visible captcha form copy / labeled inputs.
  return (
    /enter\s*(the\s*)?captcha|please\s*enter\s*captcha|type\s*the\s*(code|captcha)|captcha\s*code|simple\s*captcha/i.test(
      hay,
    ) ||
    /name=["'][^"']*captcha|id=["'][^"']*captcha|placeholder=["'][^"']*captcha/i.test(hay)
  );
}

function hasHardWaf(title: string, body: string): boolean {
  const hay = `${title} ${body}`.toLowerCase();
  // Prefer title / denial copy — "akamai" alone appears in harmless script refs.
  const denied =
    /access denied/i.test(title) ||
    /<h1[^>]*>\s*access denied/i.test(body) ||
    /you don't have permission to access/i.test(hay) ||
    /request blocked|bot.?manager/i.test(hay);
  return denied && !/enter\s*(the\s*)?captcha|please\s*enter\s*captcha/i.test(hay);
}

function hasOtpSurface(title: string, body: string, probe?: PageAuthProbe): boolean {
  const hay = `${title} ${body}`.toLowerCase();
  return (
    /enter\s*otp|otp|one[-\s]?time|verification\s*code|verify\s*otp|resend\s*otp|confirm\s*otp/i.test(
      hay,
    ) ||
    // MagicBricks split OTP boxes (#verify01…) — present even when copy is sparse.
    /id=["']verify0\d|class=["'][^"']*verify-input-otp/i.test(hay) ||
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
 * Supports single-field OTP and MagicBricks-style split boxes
 * (`#verify01`…`#verify04`, `.verify-input-otp`, maxlength=1).
 */
export async function applyOtpOnPage(
  page: Page,
  otp: string,
): Promise<{ ok: boolean; filled: boolean; clicked: string | null; detail: string }> {
  const code = String(otp || '').replace(/\D/g, '');
  if (code.length < 4) {
    return { ok: false, filled: false, clicked: null, detail: 'OTP must be at least 4 digits' };
  }

  // MagicBricks (and similar): one digit per box — must fill before single-field selectors
  // that might match an unrelated tel/number input.
  const splitSelectors = [
    'input.verify-input-otp',
    'input[id^="verify0"]',
    'input[id^="otp"][maxlength="1"]',
    'input[name^="otp"][maxlength="1"]',
    'input[autocomplete="one-time-code"][maxlength="1"]',
    'input[maxlength="1"][type="tel"]',
    'input[maxlength="1"][type="text"]',
    'input[maxlength="1"][type="number"]',
  ];
  for (const sel of splitSelectors) {
    const boxes = page.locator(sel);
    const count = await boxes.count().catch(() => 0);
    if (count < 4) continue;
    let filledCount = 0;
    try {
      for (let i = 0; i < Math.min(count, code.length); i += 1) {
        const box = boxes.nth(i);
        if (!(await box.isVisible().catch(() => false))) continue;
        await box.click({ timeout: 2_000 });
        await box.fill('');
        await box.type(code[i]!, { delay: 45 });
        filledCount += 1;
      }
      if (filledCount >= 4) {
        // Prefer MagicBricks OTP submit — a hidden OAuth "Continue" also exists on
        // the same page and steals button:has-text("Continue").first().
        const submitSelectors = [
          '#verifyOtpDiv button.m-login__btn',
          'button[onclick*="verifyOtp"]',
          '#verifyOtpDiv button:has-text("Continue")',
          'button:has-text("Verify"):visible',
          'button:has-text("Submit"):visible',
          'button:has-text("Continue"):visible',
          'button:has-text("Confirm"):visible',
          'button:has-text("Login"):visible',
          '[type="submit"]:visible',
        ];
        let clicked: string | null = null;
        for (const s of submitSelectors) {
          const loc = page.locator(s).first();
          if ((await loc.count().catch(() => 0)) === 0) continue;
          if (!(await loc.isVisible().catch(() => false))) continue;
          try {
            await loc.click({ timeout: 3_000, force: true });
            clicked = s;
            break;
          } catch {
            /* next */
          }
        }
        if (!clicked) {
          // MagicBricks wires Enter → verifyOtp(); also call it directly.
          await page.keyboard.press('Enter').catch(() => undefined);
          const invoked = await page
            .evaluate(() => {
              const fn = (window as unknown as { verifyOtp?: () => void }).verifyOtp;
              if (typeof fn === 'function') {
                fn();
                return 'verifyOtp()';
              }
              return null;
            })
            .catch(() => null);
          if (invoked) clicked = invoked;
          else clicked = 'Enter';
        }
        return {
          ok: true,
          filled: true,
          clicked,
          detail: `OTP entered via split inputs (${sel} ×${filledCount})${
            clicked ? `; submitted via ${clicked}` : ''
          }`,
        };
      }
    } catch {
      /* try next split selector */
    }
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

  // Some portals (MagicBricks/Akamai) gate the phone submit behind a CAPTCHA on the
  // same form. Auto-clicking Next before the CAPTCHA is solved submits an invalid
  // request and trips the WAF (Access Denied). If a visible CAPTCHA input *or*
  // CAPTCHA image is present, fill the phone but DO NOT submit.
  const captchaInputSelectors = [
    // MagicBricks: contenteditable div, not an <input>
    '#captchaCodeSignIn',
    '[name="captchaCodeSignIn"]',
    '.signup__captcha--input[contenteditable]',
    '#captchaDivSignIn [contenteditable]',
    'input[name*="captcha" i]',
    'input[id*="captcha" i]',
    'input[placeholder*="captcha" i]',
    'input[formcontrolname*="captcha" i]',
  ];
  const captchaImageSelectors = [
    '#captchaImageSignIn',
    'img[id*="captcha" i]',
    'img[src*="captcha" i]',
    'img[src*="simpleCaptcha" i]',
    'img[src*="contentsimpleCaptcha" i]',
    'img[alt*="captcha" i]',
  ];
  let captchaPending = false;
  for (const sel of captchaInputSelectors) {
    const loc = page.locator(sel).first();
    if ((await loc.count().catch(() => 0)) === 0) continue;
    if (await loc.isVisible().catch(() => false)) {
      captchaPending = true;
      break;
    }
  }
  if (!captchaPending) {
    for (const sel of captchaImageSelectors) {
      const loc = page.locator(sel).first();
      if ((await loc.count().catch(() => 0)) === 0) continue;
      if (await loc.isVisible().catch(() => false)) {
        captchaPending = true;
        break;
      }
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
  if (!captchaPending) {
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
  }

  return {
    ok: filled,
    filled,
    clicked,
    detail: filled
      ? `Phone entered via ${used}${
          captchaPending
            ? '; CAPTCHA present — not submitting (solve CAPTCHA first)'
            : clicked
              ? `; clicked ${clicked}`
              : ''
        }`
      : 'Could not find a phone input on the page',
  };
}
