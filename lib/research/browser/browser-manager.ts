import type { BrowserContext, Page } from 'playwright';
import { BrowserFactory } from '@/lib/research/browser/browser-factory';
import { researchBrowserPool } from '@/lib/research/browser/browser-pool';
import { PageManager } from '@/lib/research/browser/page-manager';
import { RetryManager } from '@/lib/research/browser/retry-manager';
import { SessionLoader } from '@/lib/research/browser/session-loader';
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
    const context = await researchBrowserPool.acquire(session.workspaceId, portal);
    try {
      await this.sessions.applyToContext(context, {
        encryptedCookies: session.encryptedCookies,
        encryptedStorage: session.encryptedStorage,
      });
      return await this.retries.run(() => fn(context), `context:${portal}`);
    } finally {
      researchBrowserPool.release(session.workspaceId, portal);
    }
  }

  async withPage<T>(
    session: ResearchBrowserSession,
    label: string,
    fn: (page: Page, context: BrowserContext) => Promise<T>,
  ): Promise<{ result?: T; screenshotPath?: string; error?: Error }> {
    try {
      return await this.withSessionContext(session, async (context) => {
        return this.pages.withPage(context, label, (page) => fn(page, context));
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
  }> {
    const portal = session.portal || session.portalKey || 'housing';
    const context = await researchBrowserPool.acquire(session.workspaceId, portal);
    try {
      return await this.sessions.captureFromContext(context);
    } finally {
      researchBrowserPool.release(session.workspaceId, portal);
    }
  }

  async cleanup(workspaceId: string, portal: string): Promise<void> {
    await researchBrowserPool.close(workspaceId, portal);
  }
}

export const researchBrowserManager = new BrowserManager();
