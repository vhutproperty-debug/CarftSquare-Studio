import type { BrowserContext } from 'playwright';
import { BrowserFactory } from '@/lib/research/browser/browser-factory';
import { RESEARCH_BROWSER_CONFIG } from '@/lib/research/browser/config';

type PoolKey = string;

type PoolEntry = {
  context: BrowserContext;
  lastUsed: number;
  inUse: boolean;
};

function keyOf(workspaceId: string, portal: string): PoolKey {
  return `${workspaceId}::${portal}`;
}

/**
 * Small in-process pool of persistent browser contexts.
 * Suitable for long-running Node workers (not serverless-friendly).
 */
export class BrowserPool {
  private readonly factory = new BrowserFactory();
  private readonly entries = new Map<PoolKey, PoolEntry>();

  async acquire(workspaceId: string, portal: string): Promise<BrowserContext> {
    const key = keyOf(workspaceId, portal);
    const existing = this.entries.get(key);
    if (existing) {
      const started = Date.now();
      while (existing.inUse && Date.now() - started < 60_000) {
        await new Promise((r) => setTimeout(r, 100));
      }
      if (existing.inUse) {
        throw new Error(`Browser context busy for ${portal}`);
      }
      existing.inUse = true;
      existing.lastUsed = Date.now();
      return existing.context;
    }

    if (this.entries.size >= RESEARCH_BROWSER_CONFIG.maxPoolSize) {
      await this.evictIdle();
    }

    const context = await this.factory.launchPersistent(workspaceId, portal);
    this.entries.set(key, { context, lastUsed: Date.now(), inUse: true });
    return context;
  }

  release(workspaceId: string, portal: string): void {
    const entry = this.entries.get(keyOf(workspaceId, portal));
    if (entry) {
      entry.inUse = false;
      entry.lastUsed = Date.now();
    }
  }

  async close(workspaceId: string, portal: string): Promise<void> {
    const key = keyOf(workspaceId, portal);
    const entry = this.entries.get(key);
    if (!entry) return;
    this.entries.delete(key);
    try {
      await entry.context.close();
    } catch {
      /* ignore */
    }
  }

  async closeAll(): Promise<void> {
    const keys = [...this.entries.keys()];
    for (const key of keys) {
      const [workspaceId, portal] = key.split('::');
      await this.close(workspaceId, portal);
    }
  }

  private async evictIdle(): Promise<void> {
    let oldestKey: PoolKey | null = null;
    let oldest = Number.POSITIVE_INFINITY;
    for (const [key, entry] of this.entries) {
      if (!entry.inUse && entry.lastUsed < oldest) {
        oldest = entry.lastUsed;
        oldestKey = key;
      }
    }
    if (!oldestKey) return;
    const [workspaceId, portal] = oldestKey.split('::');
    await this.close(workspaceId, portal);
  }
}

export const researchBrowserPool = new BrowserPool();
