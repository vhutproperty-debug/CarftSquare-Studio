/**
 * Connect-attempt diagnostics — screenshots + structured logs under tmp/connect-debug/<ts>/.
 * Operational only; does not change connect architecture.
 */

import fs from 'fs/promises';
import path from 'path';
import type { BrowserContext, Page, Response } from 'playwright';
import { pushWorkerLog } from '@/lib/research/browser-gateway/worker-state';

export type ConnectDebugReport = {
  at: string;
  portal: string;
  jobId: string;
  browserId: string | null;
  navigationUrl: string;
  finalUrl: string;
  httpStatus: number | null;
  redirectChain: string[];
  domContentLoaded: boolean;
  load: boolean;
  networkIdle: boolean | null;
  pageTitle: string;
  currentUrl: string;
  cookiesCount: number;
  storageStateBytes: number | null;
  consoleErrors: string[];
  requestFailures: Array<{ url: string; status?: number; failure?: string }>;
  jsExceptions: string[];
  screenshotAfterNav: string | null;
  screenshotAfter5s: string | null;
  accessDenied: boolean;
  wafHints: string[];
  elapsedMs: number;
  error: string | null;
};

function debugRoot(): string {
  return path.join(process.cwd(), 'tmp', 'connect-debug');
}

export async function createConnectDebugDir(label?: string): Promise<string> {
  const stamp = `${Date.now()}${label ? `-${label}` : ''}`;
  const dir = path.join(debugRoot(), stamp);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

/**
 * Instrument a Connect gotoLogin: redirects, console, failures, screenshots, cookies.
 */
export async function instrumentConnectNavigation(input: {
  page: Page;
  context: BrowserContext;
  portal: string;
  jobId: string;
  navigationUrl: string;
  browserId?: string | null;
  outDir?: string;
}): Promise<ConnectDebugReport> {
  const outDir = input.outDir || (await createConnectDebugDir(input.portal));
  const t0 = Date.now();
  const consoleErrors: string[] = [];
  const jsExceptions: string[] = [];
  const requestFailures: ConnectDebugReport['requestFailures'] = [];
  const redirectChain: string[] = [];

  const onConsole = (msg: { type: () => string; text: () => string }) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text().slice(0, 400));
  };
  const onPageError = (err: Error) => jsExceptions.push(String(err.message).slice(0, 400));
  const onResponse = (res: Response) => {
    const status = res.status();
    const req = res.request();
    if (req.isNavigationRequest()) {
      redirectChain.push(`${status} ${res.url()}`);
    }
    if (status >= 400) {
      requestFailures.push({
        url: res.url().slice(0, 240),
        status,
        failure: req.failure()?.errorText,
      });
    }
  };
  const onRequestFailed = (req: {
    url: () => string;
    failure: () => { errorText: string } | null;
  }) => {
    requestFailures.push({
      url: req.url().slice(0, 240),
      failure: req.failure()?.errorText || 'requestfailed',
    });
  };

  input.page.on('console', onConsole);
  input.page.on('pageerror', onPageError);
  input.page.on('response', onResponse);
  input.page.on('requestfailed', onRequestFailed);

  let httpStatus: number | null = null;
  let error: string | null = null;
  let screenshotAfterNav: string | null = null;
  let screenshotAfter5s: string | null = null;
  let domContentLoaded = false;
  let load = false;
  let networkIdle: boolean | null = null;

  try {
    const response = await input.page.goto(input.navigationUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 60_000,
    });
    httpStatus = response?.status() ?? null;
    domContentLoaded = true;

    await input.page
      .waitForLoadState('load', { timeout: 15_000 })
      .then(() => {
        load = true;
      })
      .catch(() => {
        load = false;
      });

    await input.page
      .waitForLoadState('networkidle', { timeout: 8_000 })
      .then(() => {
        networkIdle = true;
      })
      .catch(() => {
        networkIdle = false;
      });

    screenshotAfterNav = path.join(outDir, `${input.portal}-after-nav.jpg`);
    await input.page
      .screenshot({ path: screenshotAfterNav, type: 'jpeg', quality: 55 })
      .catch(() => {
        screenshotAfterNav = null;
      });

    await new Promise((r) => setTimeout(r, 5_000));

    screenshotAfter5s = path.join(outDir, `${input.portal}-after-5s.jpg`);
    await input.page
      .screenshot({ path: screenshotAfter5s, type: 'jpeg', quality: 55 })
      .catch(() => {
        screenshotAfter5s = null;
      });
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  } finally {
    input.page.off('console', onConsole);
    input.page.off('pageerror', onPageError);
    input.page.off('response', onResponse);
    input.page.off('requestfailed', onRequestFailed);
  }

  const pageTitle = await input.page.title().catch(() => '');
  const currentUrl = input.page.url();
  const cookies = await input.context.cookies().catch(() => []);
  let storageStateBytes: number | null = null;
  try {
    const state = await input.context.storageState();
    storageStateBytes = Buffer.byteLength(JSON.stringify(state), 'utf8');
  } catch {
    storageStateBytes = null;
  }

  const bodySnippet = await input.page
    .evaluate(() => (document.body?.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 600))
    .catch(() => '');
  const hay = `${pageTitle} ${currentUrl} ${bodySnippet}`.toLowerCase();
  const wafHints: string[] = [];
  if (/access denied|akamai|edgesuite|reference #/.test(hay)) wafHints.push('akamai');
  if (/cloudflare|cf-browser-verification|attention required|cf-ray/.test(hay)) {
    wafHints.push('cloudflare');
  }
  if (/captcha|recaptcha|hcaptcha|verify you are human/.test(hay)) wafHints.push('captcha');
  if (/security alert|bot.?detect|forbidden/.test(hay)) wafHints.push('waf_or_bot');
  const accessDenied = /access denied|security alert|attention required/.test(hay);
  const captchaHint = wafHints.includes('captcha');
  // Hard WAF/bot blocks are not a login surface — publishing waiting_for_login here
  // leaves the operator stuck until TTL with no OTP field (production blocker).
  // Captcha / "attention required" still needs a human in the remote window.
  const hardBlock =
    !error &&
    !captchaHint &&
    (accessDenied ||
      (typeof httpStatus === 'number' && httpStatus >= 400 && !/login|otp|phone|sign/i.test(hay)));
  if (hardBlock) {
    error = `Connect navigation blocked before login surface (portal=${input.portal} status=${httpStatus ?? 'n/a'} title=${JSON.stringify(pageTitle)} url=${currentUrl} waf=${wafHints.join(',') || 'none'})`;
  }

  const report: ConnectDebugReport = {
    at: new Date().toISOString(),
    portal: input.portal,
    jobId: input.jobId,
    browserId: input.browserId ?? null,
    navigationUrl: input.navigationUrl,
    finalUrl: currentUrl,
    httpStatus,
    redirectChain: redirectChain.slice(0, 40),
    domContentLoaded,
    load,
    networkIdle,
    pageTitle,
    currentUrl,
    cookiesCount: cookies.length,
    storageStateBytes,
    consoleErrors: consoleErrors.slice(0, 40),
    requestFailures: requestFailures.slice(0, 60),
    jsExceptions: jsExceptions.slice(0, 40),
    screenshotAfterNav,
    screenshotAfter5s,
    accessDenied,
    wafHints,
    elapsedMs: Date.now() - t0,
    error,
  };

  await fs.writeFile(
    path.join(outDir, `${input.portal}-report.json`),
    JSON.stringify(report, null, 2),
    'utf8',
  );

  pushWorkerLog(
    'info',
    [
      `connect_debug portal=${report.portal}`,
      `jobId=${report.jobId}`,
      `browserId=${report.browserId || 'n/a'}`,
      `navUrl=${report.navigationUrl}`,
      `finalUrl=${report.finalUrl}`,
      `httpStatus=${report.httpStatus ?? 'n/a'}`,
      `title=${JSON.stringify(report.pageTitle)}`,
      `cookies=${report.cookiesCount}`,
      `storageStateBytes=${report.storageStateBytes ?? 'n/a'}`,
      `domContentLoaded=${report.domContentLoaded}`,
      `load=${report.load}`,
      `networkIdle=${report.networkIdle}`,
      `accessDenied=${report.accessDenied}`,
      `waf=${report.wafHints.join(',') || 'none'}`,
      `consoleErrors=${report.consoleErrors.length}`,
      `requestFailures=${report.requestFailures.length}`,
      `jsExceptions=${report.jsExceptions.length}`,
      `shotNav=${report.screenshotAfterNav || 'n/a'}`,
      `shot5s=${report.screenshotAfter5s || 'n/a'}`,
      `elapsedMs=${report.elapsedMs}`,
      `error=${report.error || 'none'}`,
    ].join(' '),
  );

  return report;
}
