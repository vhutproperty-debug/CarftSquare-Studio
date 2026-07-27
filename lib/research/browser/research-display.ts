/**
 * Research-path virtual display — headed Chromium on Railway needs Xvfb.
 * Connect uses per-session displays; Research pool uses a shared DISPLAY.
 * Do not change Connect remote-display code from here.
 */

import { spawn } from 'child_process';
import { pushWorkerLog } from '@/lib/research/browser-gateway/worker-state';

let ensured = false;
let xvfbPid: number | null = null;

function commandExists(bin: string): boolean {
  try {
    const { execSync } = require('child_process') as typeof import('child_process');
    execSync(`command -v ${bin}`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
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

  // If Xvfb binary missing, Research headed launch will fail — surface clearly.
  if (!commandExists('Xvfb')) {
    pushWorkerLog(
      'warn',
      `research_display_no_xvfb display=${display} — headed Research may fail; install Xvfb or set RESEARCH_BROWSER_HEADLESS=true`,
    );
    ensured = true;
    return display;
  }

  // Probe: xdpyinfo if available; else assume boot entrypoint Xvfb is up.
  if (commandExists('xdpyinfo')) {
    try {
      const { execSync } = require('child_process') as typeof import('child_process');
      execSync(`xdpyinfo -display ${display}`, { stdio: 'ignore', timeout: 3_000 });
      pushWorkerLog('info', `research_display_ok display=${display} source=existing`);
      ensured = true;
      return display;
    } catch {
      /* start our own */
    }
  } else if (!opts?.force && process.env.DISPLAY) {
    // No xdpyinfo — trust boot DISPLAY on first call; force retries still spawn.
    pushWorkerLog('info', `research_display_trust display=${display} source=env`);
    ensured = true;
    return display;
  }

  pushWorkerLog('info', `research_display_start display=${display}`);
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
    pushWorkerLog(
      'error',
      `research_display_xvfb_exited display=${display} code=${child.exitCode}`,
    );
  } else {
    pushWorkerLog(
      'info',
      `research_display_ready display=${display} pid=${xvfbPid ?? 'n/a'}`,
    );
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
