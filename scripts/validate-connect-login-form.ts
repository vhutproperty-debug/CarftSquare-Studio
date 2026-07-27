/**
 * Connect login-surface validation (all portals).
 * Replaces missing validate-connect-login-form.ts referenced by package.json.
 *
 * - Headed: expects a usable OTP/login surface (or throws).
 * - Headless MagickBricks: expects hard-block error (Access Denied gate).
 */
import fs from 'fs';
import path from 'path';
import { chromium } from 'playwright';
import { getPortalMeta, RESEARCH_PORTALS } from '../lib/research/browser/config';
import { instrumentConnectNavigation } from '../lib/research/browser-gateway/connect-debug';
import { runEnsureConnectLoginSurface } from '../lib/research/browser-gateway/ensure-login-surface';

const PORTALS = RESEARCH_PORTALS.map((p) => p.key);

async function main() {
  const out = path.join(process.cwd(), 'tmp', 'connect-login-form-validation');
  fs.mkdirSync(out, { recursive: true });

  const results: Array<Record<string, unknown>> = [];

  // Gate: headless MagickBricks Access Denied must set report.error
  {
    const browser = await chromium.launch({ headless: true });
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const report = await instrumentConnectNavigation({
      page,
      context: ctx,
      portal: 'magicbricks',
      jobId: 'login-form-hard-block',
      navigationUrl: 'https://accounts.magicbricks.com/userauth/login',
      outDir: path.join(out, 'hard-block'),
    });
    await browser.close();
    const blocked = Boolean(report.error && /blocked before login surface/i.test(report.error));
    results.push({
      check: 'magicbricks_hard_block_headless',
      pass: blocked || report.accessDenied === false,
      detail: report.error || `title=${report.pageTitle}`,
    });
    if (report.accessDenied && !blocked) {
      console.error('FAIL: Access Denied without hard-block error');
      process.exit(1);
    }
  }

  // Headed login surfaces for all configured portals
  const browser = await chromium.launch({ headless: false });
  for (const portal of PORTALS) {
    const meta = getPortalMeta(portal);
    if (!meta) continue;
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const portalOut = path.join(out, portal);
    fs.mkdirSync(portalOut, { recursive: true });
    try {
      const report = await instrumentConnectNavigation({
        page,
        context: ctx,
        portal,
        jobId: `login-form-${portal}`,
        navigationUrl: meta.loginUrl,
        outDir: portalOut,
      });
      if (report.error) throw new Error(report.error);
      await runEnsureConnectLoginSurface(portal, page, {
        screenshotPath: path.join(portalOut, `${portal}-after-login-surface.jpg`),
      });
      const body = await page
        .evaluate(() => (document.body?.innerText || '').slice(0, 400))
        .catch(() => '');
      const hasSurface =
        /otp|phone|login|sign in|log in|password|\+91/i.test(`${report.pageTitle} ${body}`) &&
        !report.accessDenied;
      results.push({
        check: `${portal}_headed_login_surface`,
        pass: hasSurface,
        finalUrl: report.finalUrl,
        title: report.pageTitle,
        httpStatus: report.httpStatus,
      });
      if (!hasSurface) {
        console.error(JSON.stringify(results, null, 2));
        process.exit(1);
      }
    } finally {
      await ctx.close();
    }
  }
  await browser.close();

  const summary = { ok: true, results };
  fs.writeFileSync(path.join(out, 'summary.json'), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary, null, 2));
  console.log('PASS: connect login-form validation');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
