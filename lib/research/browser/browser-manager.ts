import type { BrowserContext, Page } from 'playwright';
import { BrowserFactory } from '@/lib/research/browser/browser-factory';
import { researchBrowserPool } from '@/lib/research/browser/browser-pool';
import { PageManager } from '@/lib/research/browser/page-manager';
import { researchPerfLog, researchPerfNow } from '@/lib/research/browser/perf';
import { RetryManager } from '@/lib/research/browser/retry-manager';
import { secretsFingerprint, SessionLoader } from '@/lib/research/browser/session-loader';
import type { ResearchBrowserSession } from '@/lib/research/types';

/**
 * High-level browser lifecycle for Prop/Research connectors.
 */
export class BrowserManager {
  private readonly factory = new BrowserFactory();
  private readonly pages = new PageManager();
  private readonly retries = new RetryManager();
  private readonly sessions = new SessionLoader();

  profilePath(workspaceId: string, portal: string): string {
    return this.factory.profileDir(workspaceId, portal);
  }

  async withSessionContext<T>(
    session: ResearchBrowserSession,
    fn: (context: BrowserContext) => Promise<T>,
  ): Promise<T> {
    const portal = session.portal || session.portalKey || 'housing';
    const acquired = await researchBrowserPool.acquire(session.workspaceId, portal);
    try {
      const fingerprint = secretsFingerprint(
        session.encryptedCookies,
        session.encryptedStorage,
      );
      if (
        session.encryptedCookies &&
        acquired.secretsFingerprint &&
        acquired.secretsFingerprint === fingerprint
      ) {
        researchPerfLog('session_apply_skipped', researchPerfNow(), {
          portal,
          reason: 'warm_fingerprint_match',
        });
      } else if (session.encryptedCookies || session.encryptedStorage) {
        await this.sessions.applyToContext(acquired.context, {
          encryptedCookies: session.encryptedCookies,
          encryptedStorage: session.encryptedStorage,
          portal,
        });
        researchBrowserPool.markSecretsApplied(session.workspaceId, portal, fingerprint);
      }
      return await this.retries.run(() => fn(acquired.context), `context:${portal}`);
    } finally {
      researchBrowserPool.release(session.workspaceId, portal);
    }
  }

  async withPage<T>(
    session: ResearchBrowserSession,
    label: string,
    fn: (page: Page, context: BrowserContext) => Promise<T>,
  ): Promise<{ result?: T; screenshotPath?: string; error?: Error }> {
    const portal = session.portal || session.portalKey || 'housing';
    try {
      return await this.withSessionContext(session, async (context) => {
        return this.retries.run(async () => {
          const page = await researchBrowserPool.acquireWarmPage(
            session.workspaceId,
            portal,
            context,
          );
          try {
            const result = await fn(page, context);
            return { result };
          } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            const dead =
              page.isClosed() ||
              /crashed|Target closed|has been closed|destroyed|Browser closed/i.test(
                err.message,
              );
            if (dead) {
              await researchBrowserPool.invalidateWarmPage(session.workspaceId, portal);
            }
            // Re-throw so RetryManager can open a fresh warm page.
            throw err;
          }
        }, `page:${portal}:${label}`);
      });
    } catch (error) {
      return {
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  async captureSessionSecrets(session: ResearchBrowserSession): Promise<{
    encryptedCookies: string;
    encryptedStorage: string;
    cookieCount: number;
  }> {
    const portal = session.portal || session.portalKey || 'housing';
    const acquired = await researchBrowserPool.acquire(session.workspaceId, portal);
    try {
      const secrets = await this.sessions.captureFromContext(acquired.context, portal);
      // Profile cookies changed — force re-apply on next acquire.
      researchBrowserPool.clearSecretsFingerprint(session.workspaceId, portal);
      return secrets;
    } finally {
      researchBrowserPool.release(session.workspaceId, portal);
    }
  }

  async cleanup(workspaceId: string, portal: string): Promise<void> {
    await researchBrowserPool.close(workspaceId, portal);
  }
}

export const researchBrowserManager = new BrowserManager();
