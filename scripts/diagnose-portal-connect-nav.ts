/**
 * Live connect-nav probe — Housing vs MagicBricks vs 99acres.
 * Evidence only; does not mutate production connectors.
 *
 * Usage: npx tsx scripts/diagnose-portal-connect-nav.ts
 */
import fs from 'fs/promises';
import path from 'path';
import { chromium, type Page } from 'playwright';

const OUT = path.join(process.cwd(), 'tmp', 'connect-nav-probe', `run-${Date.now()}`);

const PORTALS = [
  {
    key: 'housing',
    configuredLoginUrl: 'https://housing.com/user-profile',
    candidateLoginUrls: ['https://housing.com/user-profile'],
  },
  {
    key: 'magicbricks',
    configuredLoginUrl: 'https://accounts.magicbricks.com/userauth/login',
    candidateLoginUrls: [
      'https://accounts.magicbricks.com/userauth/login',
      'https://www.magicbricks.com/?login=true',
    ],
  },
  {
    key: '99acres',
    configuredLoginUrl: 'https://www.99acres.com/login-lrfv',
    candidateLoginUrls: [
      'https://www.99acres.com/login-lrfv',
      'https://www.99acres.com/',
    ],
  },
] as const;

type ProbeResult = {
  portal: string;
  url: string;
  isConfiguredLoginUrl: boolean;
  httpStatus: number | null;
  finalUrl: string;
  title: string;
  readyState: string;
  cookieCount: number;
  cookieNames: string[];
  bodySample: string;
  accessDenied: boolean;
  hasLoginFormSignals: boolean;
  hasPhoneOrOtpSignals: boolean;
  navError: string | null;
  consoleErrors: string[];
  pageErrors: string[];
  failedRequests: Array<{ url: string; status: number; failure?: string }>;
  screenshotAfterNav: string | null;
  screenshotAfter5s: string | null;
  elapsedMs: number;
};

function classify(body: string, title: string, url: string) {
  const t = `${body} ${title} ${url}`.toLowerCase();
  return {
    accessDenied: /access denied|security alert|attention required|akamai|cf-browser-verification/.test(
      t,
    ),
    hasLoginFormSignals:
      /sign in|log in|login|register|password|otp|phone number|get otp|verify/.test(t),
    hasPhoneOrOtpSignals: /otp|phone number|mobile number|enter.*phone|get otp|verify otp/.test(t),
  };
}

async function probeUrl(
  page: Page,
  portal: string,
  url: string,
  isConfigured: boolean,
): Promise<ProbeResult> {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const failedRequests: ProbeResult['failedRequests'] = [];

  const onConsole = (msg: { type: () => string; text: () => string }) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text().slice(0, 300));
  };
  const onPageError = (err: Error) => pageErrors.push(String(err.message).slice(0, 300));
  const onResponse = (res: { url: () => string; status: () => number; request: () => { failure: () => { errorText: string } | null } }) => {
    const status = res.status();
    if (status >= 400) {
      failedRequests.push({
        url: res.url().slice(0, 200),
        status,
        failure: res.request().failure()?.errorText,
      });
    }
  };

  page.on('console', onConsole);
  page.on('pageerror', onPageError);
  page.on('response', onResponse);

  const t0 = Date.now();
  let httpStatus: number | null = null;
  let navError: string | null = null;
  let screenshotAfterNav: string | null = null;
  let screenshotAfter5s: string | null = null;

  try {
    const response = await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: 60_000,
    });
    httpStatus = response?.status() ?? null;
    const safeName = url.replace(/https?:\/\//, '').replace(/[^\w.-]+/g, '_').slice(0, 80);
    screenshotAfterNav = path.join(OUT, `${portal}__${safeName}__t0.jpg`);
    await page.screenshot({ path: screenshotAfterNav, type: 'jpeg', quality: 60 }).catch(() => {
      screenshotAfterNav = null;
    });
    await page.waitForTimeout(5_000);
    screenshotAfter5s = path.join(OUT, `${portal}__${safeName}__t5.jpg`);
    await page.screenshot({ path: screenshotAfter5s, type: 'jpeg', quality: 60 }).catch(() => {
      screenshotAfter5s = null;
    });
  } catch (error) {
    navError = error instanceof Error ? error.message : String(error);
  }

  const title = await page.title().catch(() => '');
  const finalUrl = page.url();
  const readyState = await page.evaluate(() => document.readyState).catch(() => 'unknown');
  const cookies = await page.context().cookies().catch(() => []);
  const bodySample = await page
    .evaluate(() => (document.body?.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 500))
    .catch(() => '');
  const flags = classify(bodySample, title, finalUrl);

  page.off('console', onConsole);
  page.off('pageerror', onPageError);
  page.off('response', onResponse);

  return {
    portal,
    url,
    isConfiguredLoginUrl: isConfigured,
    httpStatus,
    finalUrl,
    title,
    readyState,
    cookieCount: cookies.length,
    cookieNames: cookies.map((c) => c.name).slice(0, 40),
    bodySample,
    ...flags,
    navError,
    consoleErrors: consoleErrors.slice(0, 20),
    pageErrors: pageErrors.slice(0, 20),
    failedRequests: failedRequests.slice(0, 30),
    screenshotAfterNav,
    screenshotAfter5s,
    elapsedMs: Date.now() - t0,
  };
}

async function main() {
  await fs.mkdir(OUT, { recursive: true });
  const headless = process.env.RESEARCH_BROWSER_HEADLESS === 'true';
  console.log(JSON.stringify({ phase: 'start', out: OUT, headless }, null, 2));

  const browser = await chromium.launch({
    headless,
    args: ['--disable-blink-features=AutomationControlled'],
  });

  const results: ProbeResult[] = [];

  for (const portal of PORTALS) {
    for (const url of portal.candidateLoginUrls) {
      const context = await browser.newContext({
        viewport: { width: 1365, height: 900 },
        userAgent:
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      });
      const page = await context.newPage();
      page.setDefaultTimeout(60_000);
      console.log(`PROBE ${portal.key} → ${url}`);
      const result = await probeUrl(
        page,
        portal.key,
        url,
        url === portal.configuredLoginUrl,
      );
      results.push(result);
      console.log(
        JSON.stringify(
          {
            portal: result.portal,
            url: result.url,
            configured: result.isConfiguredLoginUrl,
            status: result.httpStatus,
            finalUrl: result.finalUrl,
            title: result.title,
            accessDenied: result.accessDenied,
            loginSignals: result.hasLoginFormSignals,
            otpSignals: result.hasPhoneOrOtpSignals,
            cookies: result.cookieCount,
            navError: result.navError,
            elapsedMs: result.elapsedMs,
          },
          null,
          2,
        ),
      );
      await context.close();
    }
  }

  await browser.close();

  const summary = {
    generatedAt: new Date().toISOString(),
    outDir: OUT,
    headless,
    configuredLoginUrls: Object.fromEntries(
      PORTALS.map((p) => [p.key, p.configuredLoginUrl]),
    ),
    firstDivergence: {
      note: 'Compare configuredLoginUrl probes: first portal that shows accessDenied OR lacks login/OTP surface while Housing has OTP/profile surface.',
    },
    results,
  };

  const reportPath = path.join(OUT, 'REPORT.json');
  await fs.writeFile(reportPath, JSON.stringify(summary, null, 2), 'utf8');
  console.log(`WROTE ${reportPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
