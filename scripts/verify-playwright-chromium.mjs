/**
 * Fail-fast Playwright Chromium health check for the browser worker image.
 * Used at Docker build time and container startup — before Connect can start.
 */
import fs from 'fs';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

function fail(message) {
  console.error(`[playwright-health] FATAL: ${message}`);
  process.exit(1);
}

let playwrightPkg;
try {
  playwrightPkg = require('playwright/package.json');
} catch (error) {
  fail(`playwright package not installed (${error instanceof Error ? error.message : error})`);
}

let chromium;
try {
  ({ chromium } = require('playwright'));
} catch (error) {
  fail(`cannot import playwright (${error instanceof Error ? error.message : error})`);
}

const version = playwrightPkg.version || 'unknown';
let executablePath = '';
try {
  executablePath = chromium.executablePath();
} catch (error) {
  fail(
    `chromium.executablePath() threw: ${error instanceof Error ? error.message : error}. ` +
      'Run: npx playwright install --with-deps chromium',
  );
}

const exists = Boolean(executablePath) && fs.existsSync(executablePath);
const browsersPath = process.env.PLAYWRIGHT_BROWSERS_PATH || '(default user cache)';

console.log(`[playwright-health] playwrightVersion=${version}`);
console.log(`[playwright-health] PLAYWRIGHT_BROWSERS_PATH=${browsersPath}`);
console.log(`[playwright-health] executablePath=${executablePath || '(empty)'}`);
console.log(`[playwright-health] browserExists=${exists}`);

if (!exists) {
  fail(
    `Chromium executable missing at ${executablePath || '(no path)'}. ` +
      'Rebuild the browser-worker image so `npx playwright install chromium` runs during Docker build. ' +
      'Confirm Railway uses Dockerfile.browser-worker (railway.json builder=DOCKERFILE).',
  );
}

console.log('[playwright-health] OK — Chromium ready');
