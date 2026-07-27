/**
 * Probe NoBroker + SquareYards Connect login URL candidates.
 * Evidence under tmp/connect-debug/<ts>-nb-sy/
 */
import fs from 'fs/promises';
import path from 'path';
import { chromium } from 'playwright';
import { instrumentConnectNavigation } from '../lib/research/browser-gateway/connect-debug';

const CANDIDATES = {
  nobroker: [
    'https://www.nobroker.in/users/login',
    'https://www.nobroker.in/nb/user/login',
    'https://www.nobroker.in/',
    'https://www.nobroker.in/profile',
    'https://www.nobroker.in/signin',
    'https://www.nobroker.in/login',
  ],
  squareyards: [
    'https://www.squareyards.com/user/login',
    'https://www.squareyards.com/login',
    'https://www.squareyards.com/account',
    'https://www.squareyards.com/',
    'https://www.squareyards.com/user/dashboard',
    'https://www.squareyards.com/my-account',
  ],
} as const;

function scoreLoginSurface(input: {
  title: string;
  body: string;
  url: string;
  httpStatus: number | null;
}): {
  loginSurface: boolean;
  otpSignals: boolean;
  accessDenied: boolean;
  score: number;
  reasons: string[];
} {
  const t = `${input.title} ${input.body} ${input.url}`.toLowerCase();
  const reasons: string[] = [];
  let score = 0;
  const accessDenied = /access denied|security alert|attention required|akamai|cf-browser/.test(t);
  if (accessDenied) reasons.push('access_denied');
  if (input.httpStatus && input.httpStatus >= 400) {
    score -= 50;
    reasons.push(`http_${input.httpStatus}`);
  }
  const otpSignals = /otp|enter otp|verify otp|phone number|mobile number|enter mobile|get otp/.test(
    t,
  );
  const loginSurface =
    otpSignals ||
    /sign in|log in|login|register|password|continue with|enter your/.test(t);
  if (otpSignals) {
    score += 40;
    reasons.push('otp');
  }
  if (/login|sign in|register/.test(input.title.toLowerCase())) {
    score += 20;
    reasons.push('title_login');
  }
  if (loginSurface) {
    score += 15;
    reasons.push('login_copy');
  }
  // Prefer dedicated auth routes over homepage marketing.
  if (/\/users\/login|\/user\/login|\/nb\/user\/login|\/login/.test(input.url)) {
    score += 10;
    reasons.push('auth_path');
  }
  if (/homepage|buy|rent|search property/.test(t) && !otpSignals) {
    score -= 10;
    reasons.push('looks_marketing');
  }
  if (accessDenied) score -= 100;
  return { loginSurface, otpSignals, accessDenied, score, reasons };
}

async function main() {
  const outDir = path.join(process.cwd(), 'tmp', 'connect-debug', `${Date.now()}-nb-sy`);
  await fs.mkdir(outDir, { recursive: true });

  const browser = await chromium.launch({
    headless: process.env.RESEARCH_BROWSER_HEADLESS === 'true',
    args: ['--disable-blink-features=AutomationControlled'],
  });

  const results: Array<Record<string, unknown>> = [];

  for (const [portal, urls] of Object.entries(CANDIDATES)) {
    for (const url of urls) {
      const ctx = await browser.newContext({ viewport: { width: 1365, height: 900 } });
      const page = await ctx.newPage();
      console.log(`PROBE ${portal} → ${url}`);
      const report = await instrumentConnectNavigation({
        page,
        context: ctx,
        portal: `${portal}`,
        jobId: `probe-${portal}`,
        navigationUrl: url,
        outDir,
      });
      const body = await page
        .evaluate(() => (document.body?.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 700))
        .catch(() => '');
      const scored = scoreLoginSurface({
        title: report.pageTitle,
        body,
        url: report.finalUrl,
        httpStatus: report.httpStatus,
      });
      const row = {
        portal,
        candidateUrl: url,
        httpStatus: report.httpStatus,
        finalUrl: report.finalUrl,
        pageTitle: report.pageTitle,
        cookiesCount: report.cookiesCount,
        storageStateBytes: report.storageStateBytes,
        accessDenied: report.accessDenied || scored.accessDenied,
        wafHints: report.wafHints,
        loginSurface: scored.loginSurface,
        otpSignals: scored.otpSignals,
        score: scored.score,
        reasons: scored.reasons,
        bodySample: body.slice(0, 350),
        screenshotAfterNav: report.screenshotAfterNav,
        screenshotAfter5s: report.screenshotAfter5s,
        error: report.error,
      };
      results.push(row);
      console.log(
        JSON.stringify(
          {
            portal,
            url,
            status: row.httpStatus,
            title: row.pageTitle,
            score: row.score,
            otp: row.otpSignals,
            login: row.loginSurface,
            denied: row.accessDenied,
            cookies: row.cookiesCount,
          },
          null,
          2,
        ),
      );
      await ctx.close();
    }
  }

  await browser.close();

  const picks = (['nobroker', 'squareyards'] as const).map((portal) => {
    const rows = results
      .filter((r) => r.portal === portal && !r.accessDenied && !r.error)
      .sort((a, b) => Number(b.score) - Number(a.score));
    return { portal, best: rows[0] || null, ranked: rows.slice(0, 4) };
  });

  const summary = {
    generatedAt: new Date().toISOString(),
    outDir,
    picks,
    results,
  };
  await fs.writeFile(path.join(outDir, 'PROBE_SUMMARY.json'), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify({ outDir, picks }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
