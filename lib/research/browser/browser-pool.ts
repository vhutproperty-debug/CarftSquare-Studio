import type { BrowserContext, Page } from 'playwright';
import { BrowserFactory } from '@/lib/research/browser/browser-factory';
import { RESEARCH_BROWSER_CONFIG } from '@/lib/research/browser/config';
import { researchPerfLog, researchPerfNow } from '@/lib/research/browser/perf';

type PoolKey = string;

type PoolEntry = {
  context: BrowserContext;
  lastUsed: number;
  inUse: boolean;
  /** Fingerprint of last applied encrypted secrets (skip re-inject when unchanged). */
  secretsFingerprint: string | null;
  /** Warm page reused across validate/search while context stays alive. */
  warmPage: Page | null;
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

  async acquire(workspaceId: string, portal: string): Promise<{
    context: BrowserContext;
    secretsFingerprint: string | null;
    warm: boolean;
  }> {
    const key = keyOf(workspaceId, portal);
    const existing = this.entries.get(key);
    if (existing) {
      const started = Date.now();
      while (existing.inUse && Date.now() - started < 60_000) {
        await new Promise((r) => setTimeout(r, 50));
      }
      if (existing.inUse) {
        throw new Error(`Browser context busy for ${portal}`);
      }
      existing.inUse = true;
      existing.lastUsed = Date.now();
      researchPerfLog('browser_context_acquire', researchPerfNow(), {
        portal,
        warm: true,
      });
      return {
        context: existing.context,
        secretsFingerprint: existing.secretsFingerprint,
        warm: true,
      };
    }

    if (this.entries.size >= RESEARCH_BROWSER_CONFIG.maxPoolSize) {
      await this.evictIdle();
    }

    const t0 = researchPerfNow();
    const context = await this.factory.launchPersistent(workspaceId, portal);
    this.entries.set(key, {
      context,
      lastUsed: Date.now(),
      inUse: true,
      secretsFingerprint: null,
      warmPage: null,
    });
    researchPerfLog('browser_context_creation', t0, { portal, warm: false });
    return { context, secretsFingerprint: null, warm: false };
  }

  markSecretsApplied(workspaceId: string, portal: string, fingerprint: string): void {
    const entry = this.entries.get(keyOf(workspaceId, portal));
    if (entry) entry.secretsFingerprint = fingerprint;
  }

  clearSecretsFingerprint(workspaceId: string, portal: string): void {
    const entry = this.entries.get(keyOf(workspaceId, portal));
    if (entry) entry.secretsFingerprint = null;
  }

  async acquireWarmPage(workspaceId: string, portal: string, context: BrowserContext): Promise<Page> {
    const entry = this.entries.get(keyOf(workspaceId, portal));
    if (entry?.warmPage && !entry.warmPage.isClosed()) {
      researchPerfLog('page_reuse', researchPerfNow(), { portal, warm: true });
      return entry.warmPage;
    }
    const t0 = researchPerfNow();
    const page = await context.newPage();
    page.setDefaultTimeout(RESEARCH_BROWSER_CONFIG.defaultTimeoutMs);
    page.setDefaultNavigationTimeout(RESEARCH_BROWSER_CONFIG.navigationTimeoutMs);
    if (entry) entry.warmPage = page;
    researchPerfLog('page_create', t0, { portal, warm: false });
    return page;
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
      if (entry.warmPage && !entry.warmPage.isClosed()) {
        await entry.warmPage.close().catch(() => undefined);
      }
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
