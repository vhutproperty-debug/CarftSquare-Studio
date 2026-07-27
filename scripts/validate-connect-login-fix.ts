/**
 * Post-fix validation: config URLs + live login-surface probes.
 * Writes evidence under tmp/connect-debug/<ts>-validation/
 *
 * Usage: npx tsx scripts/validate-connect-login-fix.ts
 */
import fs from 'fs/promises';
import path from 'path';
import { chromium } from 'playwright';
import { RESEARCH_PORTALS, getPortalMeta } from '../lib/research/browser/config';
import { instrumentConnectNavigation } from '../lib/research/browser-gateway/connect-debug';
import { magicbricksConnector } from '../connectors/magicbricks';
import { ninetyNineAcresConnector } from '../connectors/99acres';
import { housingConnector } from '../connectors/housing';

const EXPECTED = {
  housing: {
    loginUrl: 'https://housing.com/user-profile',
    verifyUrl: 'https://housing.com/user-profile',
  },
  magicbricks: {
    loginUrl: 'https://accounts.magicbricks.com/userauth/login',
    verifyUrl: 'https://www.magicbricks.com/',
  },
  '99acres': {
    loginUrl: 'https://www.99acres.com/login-lrfv',
    verifyUrl: 'https://www.99acres.com/',
  },
} as const;

async function main() {
  const outDir = path.join(
    process.cwd(),
    'tmp',
    'connect-debug',
    `${Date.now()}-validation`,
  );
  await fs.mkdir(outDir, { recursive: true });

  const configChecks: Array<Record<string, unknown>> = [];
  for (const [key, expected] of Object.entries(EXPECTED)) {
    const meta = getPortalMeta(key);
    const connectorLogin =
      key === 'housing'
        ? housingConnector.getLoginUrl()
        : key === 'magicbricks'
          ? magicbricksConnector.getLoginUrl()
          : ninetyNineAcresConnector.getLoginUrl();
    const connectorVerify =
      key === 'housing'
        ? housingConnector.getVerifyUrl()
        : key === 'magicbricks'
          ? magicbricksConnector.getVerifyUrl()
          : ninetyNineAcresConnector.getVerifyUrl();

    const ok =
      meta?.loginUrl === expected.loginUrl &&
      meta?.verifyUrl === expected.verifyUrl &&
      connectorLogin === expected.loginUrl &&
      connectorVerify === expected.verifyUrl;

    configChecks.push({
      portal: key,
      ok,
      metaLoginUrl: meta?.loginUrl,
      metaVerifyUrl: meta?.verifyUrl,
      connectorLoginUrl: connectorLogin,
      connectorVerifyUrl: connectorVerify,
      expected,
    });
  }

  const legacyHits = RESEARCH_PORTALS.filter(
    (p) =>
      p.loginUrl.includes('?login=true') ||
      (p.key === '99acres' && p.loginUrl === 'https://www.99acres.com/'),
  ).map((p) => ({ key: p.key, loginUrl: p.loginUrl }));

  const browser = await chromium.launch({
    headless: process.env.RESEARCH_BROWSER_HEADLESS === 'true',
    args: ['--disable-blink-features=AutomationControlled'],
  });

  const probes: Array<Record<string, unknown>> = [];
  for (const [key, expected] of Object.entries(EXPECTED)) {
    const ctx = await browser.newContext({ viewport: { width: 1365, height: 900 } });
    const page = await ctx.newPage();
    const report = await instrumentConnectNavigation({
      page,
      context: ctx,
      portal: key,
      jobId: `validation-${key}`,
      navigationUrl: expected.loginUrl,
      outDir,
    });

    const body = await page
      .evaluate(() => (document.body?.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 500))
      .catch(() => '');
    const loginSurface =
      key === 'housing'
        ? /enter phone|continue/i.test(body)
        : key === '99acres'
          ? /login to continue|phone number|login\/register/i.test(`${report.pageTitle} ${body}`)
          : /enter mobile|login|next/i.test(body);

    probes.push({
      portal: key,
      loginUrl: expected.loginUrl,
      httpStatus: report.httpStatus,
      finalUrl: report.finalUrl,
      pageTitle: report.pageTitle,
      cookiesCount: report.cookiesCount,
      storageStateBytes: report.storageStateBytes,
      accessDenied: report.accessDenied,
      wafHints: report.wafHints,
      loginSurface,
      screenshotAfterNav: report.screenshotAfterNav,
      screenshotAfter5s: report.screenshotAfter5s,
      error: report.error,
      pass: Boolean(
        !report.accessDenied &&
          loginSurface &&
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
    legacyHits,
    probes,
    gates: {
      configOk: configChecks.every((c) => c.ok === true) && legacyHits.length === 0,
      housingLoginSurface: probes.find((p) => p.portal === 'housing')?.pass === true,
      acresLoginSurface: probes.find((p) => p.portal === '99acres')?.pass === true,
      magicbricksLoginSurface: probes.find((p) => p.portal === 'magicbricks')?.pass === true,
      magicbricksAccessDenied: probes.find((p) => p.portal === 'magicbricks')?.accessDenied === true,
    },
    note: [
      'Full Connect (noVNC + human OTP + Research Ready + restore + search) requires a live Browser Worker + Mongo.',
      'This script validates login URLs and login-surface reachability with the same instrumentation used in Connect.',
    ],
  };

  await fs.writeFile(
    path.join(outDir, 'VALIDATION_SUMMARY.json'),
    JSON.stringify(summary, null, 2),
    'utf8',
  );

  console.log(JSON.stringify(summary, null, 2));

  if (!summary.gates.configOk) {
    console.error('FAIL: config URL gate');
    process.exit(1);
  }
  if (!summary.gates.housingLoginSurface || !summary.gates.acresLoginSurface) {
    console.error('FAIL: Housing or 99acres login surface');
    process.exit(1);
  }
  if (summary.gates.magicbricksAccessDenied) {
    console.error('EXTERNAL_BLOCK: MagicBricks Access Denied — see screenshots in', outDir);
    process.exit(2);
  }
  if (!summary.gates.magicbricksLoginSurface) {
    console.error('FAIL: MagicBricks login surface');
    process.exit(1);
  }
  console.log('PASS: login URL + surface validation');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
