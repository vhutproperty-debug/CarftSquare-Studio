/**
 * Resilient Playwright navigation for Research validate + Connect login.
 * Evidence: NoBroker timed out on waitUntil=domcontentloaded (60s);
 * 99acres threw net::ERR_HTTP_RESPONSE_CODE_FAILURE before any document.
 */
import type { Page, Response } from 'playwright';
import { RESEARCH_BROWSER_CONFIG } from '@/lib/research/browser/config';

export type ResilientGotoResult = {
  response: Response | null;
  waitUntil: 'commit' | 'domcontentloaded' | 'load';
  attempts: number;
  error: string | null;
  softAccepted: boolean;
};

function isRetryableNavError(message: string): boolean {
  return /timeout|timed out|net::err_connection|net::err_timed_out|net::err_address|net::err_network|navigation.*interrupted|ERR_HTTP_RESPONSE_CODE_FAILURE/i.test(
    message,
  );
}

async function pageHasDocument(page: Page): Promise<boolean> {
  const url = page.url();
  if (!url || url === 'about:blank' || url.startsWith('chrome-error://')) return false;
  try {
    const ready = await page.evaluate(() => document.readyState);
    return ready === 'interactive' || ready === 'complete' || ready === 'loading';
  } catch {
    return /^https?:\/\//i.test(url);
  }
}

/**
 * Prefer a progressive waitUntil ladder with bounded per-step timeouts.
 * Soft-accepts a committed document after HTTP/timeout failures so Connect LiveView
 * can still publish (operator completes login / CAPTCHA / WAF challenge manually).
 */
export async function resilientPageGoto(
  page: Page,
  url: string,
  opts?: { timeoutMs?: number; maxAttempts?: number },
): Promise<ResilientGotoResult> {
  const timeoutMs = opts?.timeoutMs ?? RESEARCH_BROWSER_CONFIG.navigationTimeoutMs;
  const maxAttempts = Math.max(1, opts?.maxAttempts ?? RESEARCH_BROWSER_CONFIG.maxRetries + 1);
  const ladder: Array<{ waitUntil: 'commit' | 'domcontentloaded' | 'load'; timeout: number }> = [
    { waitUntil: 'commit', timeout: Math.min(20_000, timeoutMs) },
    { waitUntil: 'domcontentloaded', timeout: Math.min(35_000, timeoutMs) },
    { waitUntil: 'load', timeout: timeoutMs },
  ];

  let lastError: string | null = null;
  let attempts = 0;
  let lastResponse: Response | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    for (const step of ladder) {
      attempts += 1;
      try {
        const response = await page.goto(url, {
          waitUntil: step.waitUntil,
          timeout: step.timeout,
        });
        return {
          response,
          waitUntil: step.waitUntil,
          attempts,
          error: null,
          softAccepted: false,
        };
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
        // Playwright may throw ERR_HTTP_RESPONSE_CODE_FAILURE after the document committed.
        if (await pageHasDocument(page)) {
          return {
            response: lastResponse,
            waitUntil: step.waitUntil,
            attempts,
            error: null,
            softAccepted: true,
          };
        }
        if (!isRetryableNavError(lastError) && step.waitUntil !== 'commit') {
          break;
        }
      }
    }
    if (attempt < maxAttempts) {
      await new Promise((r) => setTimeout(r, Math.min(1000 * 2 ** (attempt - 1), 4000)));
    }
  }

  // Final soft check — any usable document beats a hard fail for Connect.
  if (await pageHasDocument(page)) {
    return {
      response: lastResponse,
      waitUntil: 'commit',
      attempts,
      error: null,
      softAccepted: true,
    };
  }

  return {
    response: null,
    waitUntil: 'domcontentloaded',
    attempts,
    error: lastError || 'navigation failed',
    softAccepted: false,
  };
}
