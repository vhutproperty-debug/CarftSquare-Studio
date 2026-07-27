/**
 * Multi-signal login confidence — never URL-only.
 * Used by BasePortalConnector + browser-session-manager validation.
 */

import type { Page } from 'playwright';

export type LoginConfidenceSignal = {
  name: string;
  pass: boolean;
  weight: number;
  detail?: string;
};

export type LoginConfidenceResult = {
  authenticated: boolean;
  confidence: number;
  threshold: number;
  signals: LoginConfidenceSignal[];
  summary: string;
};

export type LoginConfidenceInput = {
  url: string;
  title?: string;
  body: string;
  cookieCount: number;
  /** Portal may inject extra scored signals (DOM probes already done). */
  extra?: LoginConfidenceSignal[];
  threshold?: number;
};

import { LOGIN_CONFIDENCE_THRESHOLD } from '@/connectors/common/connector-lifecycle';

/**
 * Score authentication from page + cookie evidence.
 * Threshold default = LOGIN_CONFIDENCE_THRESHOLD.
 */
export function scoreLoginConfidence(input: LoginConfidenceInput): LoginConfidenceResult {
  const body = (input.body || '').toLowerCase();
  const title = (input.title || '').toLowerCase();
  const url = (input.url || '').toLowerCase();
  const threshold = input.threshold ?? LOGIN_CONFIDENCE_THRESHOLD;

  const signals: LoginConfidenceSignal[] = [
    {
      name: 'authenticated_cookies',
      pass: input.cookieCount >= 3,
      weight: 20,
      detail: `cookieCount=${input.cookieCount}`,
    },
    {
      name: 'logout_control',
      pass: /log\s*out|sign\s*out/.test(body),
      weight: 25,
    },
    {
      name: 'edit_profile',
      pass: /edit\s*profile/.test(body),
      weight: 20,
    },
    {
      name: 'account_menu',
      pass: /my\s*account|my\s*profile|account\s*settings|dashboard/.test(body),
      weight: 10,
    },
    {
      name: 'avatar_or_user_chrome',
      pass: /avatar|user-menu|profile-pic|logged[- ]?in/.test(body),
      weight: 10,
    },
    {
      name: 'not_login_form',
      pass: !(/enter otp|get otp|type="password"|name="password"|sign in with/.test(body)),
      weight: 15,
    },
    {
      name: 'not_security_wall',
      pass: !(/access denied|security alert|verifycaptcha|cf-browser-verification|attention required/.test(
        `${body} ${title} ${url}`,
      )),
      weight: 25,
    },
    ...(input.extra || []),
  ];

  let score = 0;
  let max = 0;
  for (const s of signals) {
    max += s.weight;
    if (s.pass) score += s.weight;
  }
  const confidence = max > 0 ? Math.round((score / max) * 100) : 0;
  const authenticated = confidence >= threshold;

  return {
    authenticated,
    confidence,
    threshold,
    signals,
    summary: authenticated
      ? `Login confidence ${confidence}/100 (threshold ${threshold})`
      : `Login confidence ${confidence}/100 below threshold ${threshold}`,
  };
}

/** Collect body + cookies + storage presence from a live Playwright page, then score. */
export async function evaluatePageLoginConfidence(
  page: Page,
  extra?: LoginConfidenceSignal[],
  threshold?: number,
): Promise<LoginConfidenceResult> {
  const url = page.url();
  const title = await page.title().catch(() => '');
  const body = await page.content().catch(() => '');
  const cookies = await page.context().cookies().catch(() => []);
  const storageKeys = await page
    .evaluate(() => {
      try {
        return localStorage.length + sessionStorage.length;
      } catch {
        return 0;
      }
    })
    .catch(() => 0);

  const storageSignal: LoginConfidenceSignal = {
    name: 'browser_storage_present',
    pass: storageKeys > 0,
    weight: 10,
    detail: `storageKeys=${storageKeys}`,
  };

  return scoreLoginConfidence({
    url,
    title,
    body,
    cookieCount: cookies.length,
    extra: [...(extra || []), storageSignal],
    threshold,
  });
}
