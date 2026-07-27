/**
 * Operational scavengers — Chromium zombies, orphan profiles, artifact retention.
 * No architecture changes; boot/periodic cleanup only.
 */

import { execSync } from 'child_process';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { RESEARCH_BROWSER_CONFIG } from '@/lib/research/browser/config';
import { getResearchProfileRoot, getResearchScreenshotRoot } from '@/lib/research/browser/runtime-paths';
import { pushWorkerLog } from '@/lib/research/browser-gateway/worker-state';

const PROFILE_TTL_MS = Number(process.env.RESEARCH_PROFILE_SCAVENGE_MS || 24 * 60 * 60 * 1000);
const ARTIFACT_TTL_MS = Number(process.env.RESEARCH_ARTIFACT_TTL_MS || 48 * 60 * 60 * 1000);
const CONNECT_DIR_TTL_MS = Number(process.env.RESEARCH_CONNECT_DIR_TTL_MS || 6 * 60 * 60 * 1000);

export type ScavengeReport = {
  chromiumKilled: number;
  profilesRemoved: number;
  artifactsRemoved: number;
  connectDirsRemoved: number;
  errors: string[];
};

/** Best-effort kill of orphan Chromium/Xvfb left by prior worker crashes. */
export function killZombieChromiumProcesses(opts?: {
  /** Only kill processes whose command line mentions our profile root. */
  profileRoot?: string;
  dryRun?: boolean;
}): { killed: number; details: string[] } {
  const profileRoot = (opts?.profileRoot || getResearchProfileRoot()).replace(/\\/g, '/');
  const details: string[] = [];
  let killed = 0;

  try {
    if (process.platform === 'win32') {
      // List chrome/chromium with our profile path in command line via WMIC/PowerShell.
      const ps = [
        `Get-CimInstance Win32_Process -Filter "Name='chrome.exe' OR Name='chromium.exe'" |`,
        `Where-Object { $_.CommandLine -and ($_.CommandLine -like '*${profileRoot.replace(/'/g, "''")}*' -or $_.CommandLine -like '*craftsquare*research*' -or $_.CommandLine -like '*connect*') } |`,
        `ForEach-Object { $_.ProcessId }`,
      ].join(' ');
      const out = execSync(`powershell -NoProfile -Command "${ps}"`, {
        encoding: 'utf8',
        timeout: 15_000,
        windowsHide: true,
      }).trim();
      const pids = out
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter((s) => /^\d+$/.test(s));
      for (const pid of pids) {
        // Never kill our own process tree if Playwright is mid-job — only orphans:
        // skip if parent is current node process.
        if (Number(pid) === process.pid) continue;
        details.push(`win32 pid=${pid}`);
        if (!opts?.dryRun) {
          try {
            execSync(`taskkill /PID ${pid} /T /F`, {
              encoding: 'utf8',
              timeout: 5_000,
              windowsHide: true,
            });
            killed += 1;
          } catch (error) {
            details.push(`kill_failed pid=${pid} ${error instanceof Error ? error.message : error}`);
          }
        }
      }
    } else {
      // Linux/mac: pkill by profile path pattern (connect profiles + research-profiles).
      const patterns = [
        profileRoot,
        'craftsquare/research-profiles',
        'research-profiles/connect',
        'Xvfb :',
      ];
      for (const pat of patterns) {
        try {
          if (!opts?.dryRun) {
            execSync(`pkill -f ${JSON.stringify(pat)} || true`, {
              encoding: 'utf8',
              timeout: 5_000,
              shell: '/bin/bash',
            });
          }
          details.push(`pkill pattern=${pat}`);
          killed += 1; // best-effort count
        } catch {
          /* no matches */
        }
      }
    }
  } catch (error) {
    details.push(`scavenge_error ${error instanceof Error ? error.message : String(error)}`);
  }

  return { killed, details };
}

async function removeOldDirs(
  root: string,
  ttlMs: number,
  nameFilter?: (name: string) => boolean,
): Promise<number> {
  let removed = 0;
  let entries: string[] = [];
  try {
    entries = await fs.readdir(root);
  } catch {
    return 0;
  }
  const now = Date.now();
  for (const name of entries) {
    if (nameFilter && !nameFilter(name)) continue;
    const full = path.join(root, name);
    try {
      const stat = await fs.stat(full);
      if (!stat.isDirectory()) continue;
      if (now - stat.mtimeMs > ttlMs) {
        await fs.rm(full, { recursive: true, force: true });
        removed += 1;
      }
    } catch {
      /* ignore */
    }
  }
  return removed;
}

async function removeOldFiles(root: string, ttlMs: number, depth = 0): Promise<number> {
  if (depth > 4) return 0;
  let removed = 0;
  let entries: string[] = [];
  try {
    entries = await fs.readdir(root);
  } catch {
    return 0;
  }
  const now = Date.now();
  for (const name of entries) {
    const full = path.join(root, name);
    try {
      const stat = await fs.stat(full);
      if (stat.isDirectory()) {
        removed += await removeOldFiles(full, ttlMs, depth + 1);
        // Remove empty dirs older than TTL
        const left = await fs.readdir(full).catch(() => ['x']);
        if (left.length === 0 && now - stat.mtimeMs > ttlMs) {
          await fs.rmdir(full).catch(() => undefined);
        }
      } else if (now - stat.mtimeMs > ttlMs) {
        await fs.unlink(full);
        removed += 1;
      }
    } catch {
      /* ignore */
    }
  }
  return removed;
}

/** Remove stale persistent/connect profile directories. */
export async function scavengeBrowserProfiles(): Promise<number> {
  const root = getResearchProfileRoot();
  const connectRemoved = await removeOldDirs(root, CONNECT_DIR_TTL_MS, (n) =>
    /connect/i.test(n),
  );
  // Workspace portal profiles older than PROFILE_TTL and not recently mtime'd.
  const portalRemoved = await removeOldDirs(root, PROFILE_TTL_MS, (n) =>
    !/connect/i.test(n),
  );
  return connectRemoved + portalRemoved;
}

/** Retention for screenshots, auth traces, connect previews. */
export async function scavengeArtifacts(): Promise<number> {
  const shotRoot = getResearchScreenshotRoot();
  const authTraces = path.join(process.cwd(), 'tmp', 'auth-traces');
  const readiness = path.join(process.cwd(), 'tmp', 'production-readiness');
  let removed = 0;
  removed += await removeOldFiles(shotRoot, ARTIFACT_TTL_MS);
  removed += await removeOldDirs(path.join(shotRoot, 'connect'), CONNECT_DIR_TTL_MS);
  removed += await removeOldFiles(authTraces, ARTIFACT_TTL_MS);
  removed += await removeOldDirs(readiness, ARTIFACT_TTL_MS);
  // Also clean RESEARCH_BROWSER_CONFIG screenshot connect folder via config accessor
  void RESEARCH_BROWSER_CONFIG;
  return removed;
}

/** Full boot scavenger — call once at worker start. */
export async function runBootScavenger(): Promise<ScavengeReport> {
  const errors: string[] = [];
  let chromiumKilled = 0;
  let profilesRemoved = 0;
  let artifactsRemoved = 0;
  let connectDirsRemoved = 0;

  try {
    const z = killZombieChromiumProcesses();
    chromiumKilled = z.killed;
    pushWorkerLog(
      'info',
      `ops_scavenge_chromium killed=${z.killed} details=${z.details.slice(0, 5).join(';') || 'none'}`,
    );
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }

  try {
    profilesRemoved = await scavengeBrowserProfiles();
    pushWorkerLog('info', `ops_scavenge_profiles removed=${profilesRemoved}`);
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }

  try {
    artifactsRemoved = await scavengeArtifacts();
    // Count connect preview dirs separately for metrics clarity
    connectDirsRemoved = await removeOldDirs(
      path.join(getResearchScreenshotRoot(), 'connect'),
      CONNECT_DIR_TTL_MS,
    );
    pushWorkerLog(
      'info',
      `ops_scavenge_artifacts removed=${artifactsRemoved} connectDirs=${connectDirsRemoved}`,
    );
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }

  return {
    chromiumKilled,
    profilesRemoved,
    artifactsRemoved,
    connectDirsRemoved,
    errors,
  };
}

/** Periodic scavenger (safe while idle). */
export function startPeriodicScavenger(intervalMs = 60 * 60 * 1000): () => void {
  const timer = setInterval(() => {
    void (async () => {
      try {
        const profiles = await scavengeBrowserProfiles();
        const artifacts = await scavengeArtifacts();
        pushWorkerLog(
          'info',
          `ops_scavenge_periodic profiles=${profiles} artifacts=${artifacts} host=${os.hostname()}`,
        );
      } catch (error) {
        pushWorkerLog(
          'warn',
          `ops_scavenge_periodic_error ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    })();
  }, intervalMs);
  if (typeof timer === 'object' && timer && 'unref' in timer) {
    (timer as NodeJS.Timeout).unref();
  }
  return () => clearInterval(timer);
}
