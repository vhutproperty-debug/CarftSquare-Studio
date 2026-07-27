/**
 * Validates Connect hard-block gate: Access Denied must set report.error
 * (gotoLogin callers throw — must not reach waiting_for_login).
 */
import fs from 'fs';
import path from 'path';
import { chromium } from 'playwright';
import { instrumentConnectNavigation } from '../lib/research/browser-gateway/connect-debug';

async function main() {
  const out = path.join(process.cwd(), 'tmp', 'connect-rca-gate');
  fs.mkdirSync(out, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  const report = await instrumentConnectNavigation({
    page,
    context: ctx,
    portal: 'magicbricks',
    jobId: 'rca-hard-block',
    navigationUrl: 'https://accounts.magicbricks.com/userauth/login',
    outDir: out,
  });

  await browser.close();

  const blocked =
    Boolean(report.error) && /blocked before login surface/i.test(report.error || '');
  const result = {
    blocked,
    accessDenied: report.accessDenied,
    httpStatus: report.httpStatus,
    title: report.pageTitle,
    error: report.error ? report.error.slice(0, 500) : null,
    expect: 'report.error must be set for Access Denied (gotoLogin throws)',
  };
  fs.writeFileSync(path.join(out, 'gate.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));

  // If MagickBricks returned a real login page from this IP, assert the positive path instead.
  if (!blocked && report.accessDenied === false && /login/i.test(report.pageTitle || '')) {
    console.log(JSON.stringify({ note: 'portal returned login surface — hard-block N/A this run', ok: true }));
    return;
  }
  if (!blocked) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
