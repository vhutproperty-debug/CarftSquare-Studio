import fs from 'fs/promises';
import path from 'path';
import { getResearchProfileRoot, ensureDir } from '@/lib/research/browser/runtime-paths';

type LockHandle = {
  lockPath: string;
  release: () => Promise<void>;
};

const inProcessLocks = new Set<string>();

function sanitizeKey(key: string): string {
  return key.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 180);
}

/**
 * Exclusive lock for a Connect session / profile path.
 * Combines in-process Set + exclusive lock file to stop duplicate browsers.
 */
export async function acquireProfileLock(
  key: string,
  opts: { timeoutMs?: number; staleMs?: number } = {},
): Promise<LockHandle> {
  const timeoutMs = opts.timeoutMs ?? 30_000;
  const staleMs = opts.staleMs ?? 30 * 60 * 1000;
  const lockDir = await ensureDir(path.join(getResearchProfileRoot(), 'locks'));
  const lockPath = path.join(lockDir, `${sanitizeKey(key)}.lock`);
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (inProcessLocks.has(key)) {
      await sleep(100);
      continue;
    }

    try {
      const fh = await fs.open(lockPath, 'wx');
      await fh.writeFile(
        JSON.stringify({
          key,
          pid: process.pid,
          at: new Date().toISOString(),
        }),
      );
      await fh.close();
      inProcessLocks.add(key);
      return {
        lockPath,
        release: async () => {
          inProcessLocks.delete(key);
          await fs.rm(lockPath, { force: true }).catch(() => undefined);
        },
      };
    } catch (error) {
      const code = (error as NodeJS.ErrnoException)?.code;
      if (code === 'EEXIST') {
        try {
          const stat = await fs.stat(lockPath);
          if (Date.now() - stat.mtimeMs > staleMs) {
            await fs.rm(lockPath, { force: true }).catch(() => undefined);
            continue;
          }
        } catch {
          /* retry */
        }
        await sleep(150);
        continue;
      }
      throw error;
    }
  }

  throw new Error(`Connect session busy — could not acquire profile lock for ${key}`);
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
