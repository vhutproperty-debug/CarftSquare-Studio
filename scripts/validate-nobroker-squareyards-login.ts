/**
 * Validate NoBroker + SquareYards Connect login surfaces after fix.
 */
import fs from 'fs/promises';
import path from 'path';
import { chromium } from 'playwright';
import { getPortalMeta } from '../lib/research/browser/config';
import { instrumentConnectNavigation } from '../lib/research/browser-gateway/connect-debug';
import { runEnsureConnectLoginSurface } from '../lib/research/browser-gateway/ensure-login-surface';
import { nobrokerConnector } from '../connectors/nobroker';
import { squareyardsConnector } from '../connectors/squareyards';

async function main() {
  const outDir = path.join(
    process.cwd(),
    'tmp',
    'connect-debug',
    `${Date.now()}-nb-sy-validation`,
  );
  await fs.mkdir(outDir, { recursive: true });

  const expected = {
    nobroker: {
      loginUrl: 'https://www.nobroker.in/',
      verifyUrl: 'https://www.nobroker.in/',
    },
    squareyards: {
      loginUrl: 'https://www.squareyards.com/user/login',
      verifyUrl: 'https://www.squareyards.com/',
    },
  } as const;

  const configChecks = (['nobroker', 'squareyards'] as const).map((key) => {
    const meta = getPortalMeta(key);
    const connector = key === 'nobroker' ? nobrokerConnector : squareyardsConnector;
    return {
      portal: key,
      ok:
        meta?.loginUrl === expected[key].loginUrl &&
        meta?.verifyUrl === expected[key].verifyUrl &&
        connector.getLoginUrl() === expected[key].loginUrl &&
        connector.getVerifyUrl() === expected[key].verifyUrl,
      metaLoginUrl: meta?.loginUrl,
      connectorLoginUrl: connector.getLoginUrl(),
      expected: expected[key],
    };
  });

  const browser = await chromium.launch({
    headless: process.env.RESEARCH_BROWSER_HEADLESS === 'true',
    args: ['--disable-blink-features=AutomationControlled'],
  });

  const probes: Array<Record<string, unknown>> = [];

  for (const key of ['nobroker', 'squareyards'] as const) {
    const ctx = await browser.newContext({ viewport: { width: 1365, height: 900 } });
    const page = await ctx.newPage();
    const loginUrl = expected[key].loginUrl;
    const report = await instrumentConnectNavigation({
      page,
      context: ctx,
      portal: key,
      jobId: `validation-${key}`,
      navigationUrl: loginUrl,
      outDir,
    });
    await runEnsureConnectLoginSurface(key, page, {
      screenshotPath: path.join(outDir, `${key}-after-login-surface.jpg`),
    });

    const body = await page
      .evaluate(() => (document.body?.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 600))
      .catch(() => '');
    const phoneVisible =
      key === 'nobroker'
        ? await page.locator('#signUp-phoneNumber').first().isVisible().catch(() => false)
        : /enter mobile|proceed to login|login to continue/i.test(body) ||
          (await page.locator('#send_otp_btn').first().isVisible().catch(() => false));

    probes.push({
      portal: key,
      loginUrl,
      httpStatus: report.httpStatus,
      finalUrl: page.url(),
      pageTitle: await page.title().catch(() => report.pageTitle),
      cookiesCount: (await ctx.cookies()).length,
      accessDenied: report.accessDenied,
      wafHints: report.wafHints,
      loginSurface: Boolean(phoneVisible),
      screenshotAfterNav: report.screenshotAfterNav,
      screenshotAfter5s: report.screenshotAfter5s,
      screenshotAfterLoginSurface: path.join(outDir, `${key}-after-login-surface.jpg`),
      error: report.error,
      pass: Boolean(
        !report.accessDenied &&
          phoneVisible &&
          report.httpStatus &&
          report.httpStatus < 400 &&
          !report.error,
      ),
    });
    await ctx.close();
  }

  await browser.close();

  const summary = {
    generatedAt: new Date().toISOString(),
    outDir,
    configChecks,
    probes,
    gates: {
      configOk: configChecks.every((c) => c.ok),
      nobrokerPass: probes.find((p) => p.portal === 'nobroker')?.pass === true,
      squareyardsPass: probes.find((p) => p.portal === 'squareyards')?.pass === true,
    },
  };
  await fs.writeFile(
    path.join(outDir, 'VALIDATION_SUMMARY.json'),
    JSON.stringify(summary, null, 2),
  );
  console.log(JSON.stringify(summary, null, 2));

  if (!summary.gates.configOk || !summary.gates.nobrokerPass || !summary.gates.squareyardsPass) {
    process.exit(1);
  }
  console.log('PASS: NoBroker + SquareYards login surface validation');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
