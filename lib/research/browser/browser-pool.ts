import type { BrowserContext, Page } from 'playwright';
import { BrowserFactory } from '@/lib/research/browser/browser-factory';
import { RESEARCH_BROWSER_CONFIG } from '@/lib/research/browser/config';
import { researchPerfLog, researchPerfNow } from '@/lib/research/browser/perf';
import { pushWorkerLog } from '@/lib/research/browser-gateway/worker-state';

type PoolKey = string;

type PoolEntry = {
  context: BrowserContext;
  lastUsed: number;
  inUse: boolean;
  /** When the current lease started (ms since epoch), or null if free. */
  leaseStartedAt: number | null;
  /** Fingerprint of last applied encrypted secrets (skip re-inject when unchanged). */
  secretsFingerprint: string | null;
  /** Warm page reused across validate/search while context stays alive. */
  warmPage: Page | null;
};

function keyOf(workspaceId: string, portal: string): PoolKey {
  return `${workspaceId}::${portal}`;
}

/** Max time a pool lease may be held before force-release (stale lock recovery). */
function maxLeaseMs(): number {
  return Number(
    process.env.RESEARCH_BROWSER_POOL_LEASE_MS ||
      Math.max(RESEARCH_BROWSER_CONFIG.navigationTimeoutMs * 2, 120_000),
  );
}

/**
 * Small in-process pool of persistent browser contexts.
 * Suitable for long-running Node workers (not serverless-friendly).
 *
 * Evidence (Housing E2E): concurrent validate left `inUse=true` past waiter timeout →
 * "Browser context busy for housing". Lease expiry + closed-context eviction fix that.
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
    let existing = this.entries.get(key);

    if (existing) {
      // Drop dead contexts so we never wait on a closed Chromium.
      if (this.isContextDead(existing.context)) {
        pushWorkerLog(
          'warn',
          `browser_pool_dead_context portal=${portal} — recreating`,
        );
        await this.close(workspaceId, portal);
        existing = undefined;
      }
    }

    if (existing) {
      const started = Date.now();
      const leaseCap = maxLeaseMs();
      while (existing.inUse && Date.now() - started < leaseCap) {
        this.forceReleaseIfStale(workspaceId, portal, existing, leaseCap);
        if (!existing.inUse) break;
        await new Promise((r) => setTimeout(r, 50));
      }
      if (existing.inUse) {
        // Last resort: steal stale lease rather than fail Housing Research forever.
        if (
          existing.leaseStartedAt &&
          Date.now() - existing.leaseStartedAt >= leaseCap
        ) {
          pushWorkerLog(
            'warn',
            `browser_pool_force_release portal=${portal} heldMs=${
              Date.now() - existing.leaseStartedAt
            } leaseCapMs=${leaseCap}`,
          );
          existing.inUse = false;
          existing.leaseStartedAt = null;
        } else {
          throw new Error(`Browser context busy for ${portal}`);
        }
      }
      existing.inUse = true;
      existing.leaseStartedAt = Date.now();
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
      leaseStartedAt: Date.now(),
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
      try {
        // Crashed Chromium renderers often still report !isClosed() and page.url()
        // may not throw — probe the JS world so we never reuse a dead Page.
        await entry.warmPage.evaluate(() => true);
        researchPerfLog('page_reuse', researchPerfNow(), { portal, warm: true });
        return entry.warmPage;
      } catch {
        await this.invalidateWarmPage(workspaceId, portal);
      }
    }
    const t0 = researchPerfNow();
    const page = await context.newPage();
    page.setDefaultTimeout(RESEARCH_BROWSER_CONFIG.defaultTimeoutMs);
    page.setDefaultNavigationTimeout(RESEARCH_BROWSER_CONFIG.navigationTimeoutMs);
    page.on('crash', () => {
      const current = this.entries.get(keyOf(workspaceId, portal));
      if (current?.warmPage === page) current.warmPage = null;
    });
    if (entry) entry.warmPage = page;
    researchPerfLog('page_create', t0, { portal, warm: false });
    return page;
  }

  /** Drop a dead/crashed warm page so the next acquire opens a fresh one. */
  async invalidateWarmPage(workspaceId: string, portal: string): Promise<void> {
    const entry = this.entries.get(keyOf(workspaceId, portal));
    if (!entry?.warmPage) return;
    const page = entry.warmPage;
    entry.warmPage = null;
    researchPerfLog('page_invalidate', researchPerfNow(), { portal });
    try {
      if (!page.isClosed()) await page.close();
    } catch {
      /* ignore */
    }
  }

  release(workspaceId: string, portal: string): void {
    const entry = this.entries.get(keyOf(workspaceId, portal));
    if (entry) {
      entry.inUse = false;
      entry.leaseStartedAt = null;
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

  /** Operational metric — number of pooled contexts in this process. */
  size(): number {
    return this.entries.size;
  }

  /** Count contexts currently marked in-use. */
  inUseCount(): number {
    let n = 0;
    for (const entry of this.entries.values()) {
      if (entry.inUse) n += 1;
    }
    return n;
  }

  private isContextDead(context: BrowserContext): boolean {
    try {
      // pages() throws when the browser/context is gone.
      context.pages();
      const browser = context.browser();
      if (browser && !browser.isConnected()) return true;
      return false;
    } catch {
      return true;
    }
  }

  private forceReleaseIfStale(
    workspaceId: string,
    portal: string,
    entry: PoolEntry,
    leaseCap: number,
  ): void {
    if (!entry.inUse || !entry.leaseStartedAt) return;
    if (Date.now() - entry.leaseStartedAt < leaseCap) return;
    pushWorkerLog(
      'warn',
      `browser_pool_stale_lease portal=${portal} workspaceId=${workspaceId} heldMs=${
        Date.now() - entry.leaseStartedAt
      }`,
    );
    entry.inUse = false;
    entry.leaseStartedAt = null;
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
