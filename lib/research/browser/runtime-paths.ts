import fs from 'fs';
import fsPromises from 'fs/promises';
import os from 'os';
import path from 'path';

let cachedProfileRoot: string | null = null;
let cachedScreenshotRoot: string | null = null;

function isVarTaskPath(p: string): boolean {
  const normalized = p.replace(/\\/g, '/').toLowerCase();
  return normalized === '/var/task' || normalized.startsWith('/var/task/');
}

function probeWritable(dir: string): boolean {
  try {
    fs.mkdirSync(dir, { recursive: true });
    const probe = path.join(dir, `.write-probe-${process.pid}-${Date.now()}`);
    fs.writeFileSync(probe, 'ok');
    fs.unlinkSync(probe);
    return true;
  } catch {
    return false;
  }
}

/**
 * Resolve a writable data root for research browser artifacts.
 * Never uses read-only hosts (e.g. Vercel `/var/task`).
 * Prefer env → Railway volume → OS tmp → cwd (when writable).
 */
export function resolveWritableResearchRoot(
  kind: 'profiles' | 'screenshots',
  envOverride?: string | null,
): string {
  const label = kind === 'profiles' ? 'research-profiles' : 'research-screenshots';
  const candidates: string[] = [];

  if (envOverride?.trim()) {
    candidates.push(path.resolve(envOverride.trim()));
  }

  const volume = process.env.RAILWAY_VOLUME_MOUNT_PATH?.trim();
  if (volume) {
    candidates.push(path.join(volume, label));
  }

  // Railway / Docker / Vercel: /tmp (or os.tmpdir) is always the safe default.
  candidates.push(path.join(os.tmpdir(), 'craftsquare', label));
  if (process.platform !== 'win32') {
    candidates.push(path.join('/tmp', 'craftsquare', label));
  }

  const cwd = process.cwd();
  if (!isVarTaskPath(cwd)) {
    // Historical local layout under the repo (dev machines).
    candidates.push(
      path.join(cwd, kind === 'profiles' ? '.research-profiles' : '.research-screenshots'),
    );
  }

  for (const candidate of candidates) {
    if (isVarTaskPath(candidate)) continue;
    if (probeWritable(candidate)) {
      return candidate;
    }
  }

  throw new Error(
    `Profile directory unavailable — no writable path for ${label}. Set RESEARCH_BROWSER_${
      kind === 'profiles' ? 'PROFILE' : 'SCREENSHOT'
    }_ROOT to a writable directory.`,
  );
}

export function getResearchProfileRoot(): string {
  if (!cachedProfileRoot) {
    cachedProfileRoot = resolveWritableResearchRoot(
      'profiles',
      process.env.RESEARCH_BROWSER_PROFILE_ROOT,
    );
  }
  return cachedProfileRoot;
}

export function getResearchScreenshotRoot(): string {
  if (!cachedScreenshotRoot) {
    cachedScreenshotRoot = resolveWritableResearchRoot(
      'screenshots',
      process.env.RESEARCH_BROWSER_SCREENSHOT_ROOT,
    );
  }
  return cachedScreenshotRoot;
}

/** Test helper — clear cached roots after env changes. */
export function resetResearchRuntimePathCache(): void {
  cachedProfileRoot = null;
  cachedScreenshotRoot = null;
}

/**
 * Fresh per-Connect-session Chromium profile.
 * Always deletes any prior directory — never reuse a Chromium user-data-dir.
 */
export async function prepareConnectProfileDir(
  connectSessionId: string,
  portal: string,
): Promise<string> {
  const root = getResearchProfileRoot();
  const dir = path.join(root, 'connect-sessions', connectSessionId, portal);
  await fsPromises.rm(dir, { recursive: true, force: true }).catch(() => undefined);
  await fsPromises.mkdir(dir, { recursive: true });
  return dir;
}

export async function removeConnectProfileDir(profileDir: string): Promise<void> {
  if (!profileDir) return;
  await fsPromises.rm(profileDir, { recursive: true, force: true }).catch(() => undefined);
}

/** Long-lived pool profile (validation/search) — still under writable root. */
export function poolProfileDir(workspaceId: string, portal: string): string {
  return path.join(getResearchProfileRoot(), 'pool', workspaceId, portal);
}

export async function ensureDir(dir: string): Promise<string> {
  await fsPromises.mkdir(dir, { recursive: true });
  return dir;
}
