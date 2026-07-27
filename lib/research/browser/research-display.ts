/**
 * Research-path virtual display — headed Chromium on Railway needs Xvfb.
 * Connect uses per-session displays; Research pool uses a shared DISPLAY.
 * Do not change Connect remote-display code from here.
 *
 * Logging uses console only to avoid circular imports with worker-state /
 * browser-pool / BrowserFactory.
 */

import { spawn, execSync } from 'child_process';

let ensured = false;
let xvfbPid: number | null = null;

function commandExists(bin: string): boolean {
  try {
    execSync(`command -v ${bin}`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function log(level: 'info' | 'warn' | 'error', message: string) {
  const line = `[research-display] ${message}`;
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.info(line);
}

/**
 * Ensure process.env.DISPLAY points at a live Xvfb for Research headed launches.
 * Idempotent per worker process unless force=true (retry after Xvfb death).
 */
export async function ensureResearchDisplay(opts?: { force?: boolean }): Promise<string | null> {
  if (process.platform === 'win32') {
    return process.env.DISPLAY || null;
  }

  const display = (process.env.DISPLAY || ':99').trim() || ':99';
  process.env.DISPLAY = display;

  if (ensured && !opts?.force) return display;

  if (!commandExists('Xvfb')) {
    log(
      'warn',
      `no_xvfb display=${display} — headed Research may fail; install Xvfb or set RESEARCH_BROWSER_HEADLESS=true`,
    );
    ensured = true;
    return display;
  }

  if (commandExists('xdpyinfo')) {
    try {
      execSync(`xdpyinfo -display ${display}`, { stdio: 'ignore', timeout: 3_000 });
      log('info', `ok display=${display} source=existing`);
      ensured = true;
      return display;
    } catch {
      /* start our own */
    }
  } else if (!opts?.force && process.env.DISPLAY) {
    log('info', `trust display=${display} source=env`);
    ensured = true;
    return display;
  }

  log('info', `start display=${display}`);
  const child = spawn(
    'Xvfb',
    [display, '-screen', '0', '1365x900x24', '-ac', '+extension', 'GLX', '+render', '-noreset'],
    {
      detached: true,
      stdio: 'ignore',
      env: process.env,
    },
  );
  child.unref();
  xvfbPid = child.pid ?? null;
  await sleep(600);

  if (child.exitCode !== null) {
    log('error', `xvfb_exited display=${display} code=${child.exitCode}`);
  } else {
    log('info', `ready display=${display} pid=${xvfbPid ?? 'n/a'}`);
  }

  ensured = true;
  return display;
}

export function researchDisplayEnv(): NodeJS.ProcessEnv {
  const display = process.env.DISPLAY || ':99';
  return {
    ...process.env,
    DISPLAY: display,
  };
}
