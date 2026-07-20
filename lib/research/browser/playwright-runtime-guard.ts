import fs from 'fs';
import os from 'os';
import path from 'path';

/**
 * Playwright must only run on the Browser Worker (Railway Docker image),
 * never on Vercel serverless (`/home/sbx_user…/.cache/ms-playwright`).
 */
export function isServerlessPlaywrightHost(): boolean {
  if (process.env.VERCEL === '1' || process.env.VERCEL === 'true') return true;
  if (process.env.AWS_LAMBDA_FUNCTION_NAME) return true;
  if (process.env.NEXT_RUNTIME === 'edge') return true;
  const home = (process.env.HOME || os.homedir() || '').replace(/\\/g, '/');
  if (home.includes('/sbx_user') || home.startsWith('/var/task')) return true;
  const cwd = process.cwd().replace(/\\/g, '/');
  if (cwd === '/var/task' || cwd.startsWith('/var/task/')) return true;
  return false;
}

export function assertPlaywrightRuntimeAllowed(caller: string): void {
  if (isServerlessPlaywrightHost()) {
    throw new Error(
      `Playwright cannot run on this host (${caller}). ` +
        'Chromium is only available on the Railway Browser Worker ' +
        '(Dockerfile.browser-worker + PLAYWRIGHT_BROWSERS_PATH=/ms-playwright). ' +
        'Use Connect / worker validate — never launch Chromium from Vercel.',
    );
  }
}

/** Optional soft check used by worker boot / diagnostics. */
export function describeChromiumInstall(): {
  browsersPath: string;
  executablePath: string | null;
  exists: boolean;
} {
  const browsersPath =
    process.env.PLAYWRIGHT_BROWSERS_PATH ||
    path.join(os.homedir(), '.cache', 'ms-playwright');
  let executablePath: string | null = null;
  try {
    if (fs.existsSync(browsersPath)) {
      const chromiumDirs = fs
        .readdirSync(browsersPath)
        .filter((name) => name.startsWith('chromium-'))
        .sort();
      const latest = chromiumDirs[chromiumDirs.length - 1];
      if (latest) {
        const candidateLinux = path.join(
          browsersPath,
          latest,
          'chrome-linux64',
          'chrome',
        );
        const candidateLinuxLegacy = path.join(
          browsersPath,
          latest,
          'chrome-linux',
          'chrome',
        );
        if (fs.existsSync(candidateLinux)) executablePath = candidateLinux;
        else if (fs.existsSync(candidateLinuxLegacy)) {
          executablePath = candidateLinuxLegacy;
        }
      }
    }
  } catch {
    executablePath = null;
  }
  const exists = Boolean(executablePath && fs.existsSync(executablePath));
  return { browsersPath, executablePath, exists };
}
