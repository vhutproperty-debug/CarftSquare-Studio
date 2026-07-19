import fs from 'fs/promises';
import path from 'path';
import { chromium, type BrowserContext, type Page } from 'playwright';
import { SessionLoader } from '@/lib/research/browser/session-loader';
import type { BrowserLaunchHandle, BrowserProviderAdapter } from '@/lib/research/browser-gateway/types';

/**
 * Self-hosted / Docker Playwright adapter.
 * Runs only inside the browser worker process — never from Next.js handlers.
 */
export class SelfHostedBrowserAdapter implements BrowserProviderAdapter {
  readonly kind = 'self_hosted' as const;

  async launchLoginSession(input: {
    workspaceId: string;
    portal: string;
    loginUrl: string;
    profileDir: string;
  }): Promise<BrowserLaunchHandle> {
    await fs.mkdir(input.profileDir, { recursive: true });
    const headless = process.env.RESEARCH_CONNECT_HEADLESS === 'true';
    const context: BrowserContext = await chromium.launchPersistentContext(input.profileDir, {
      headless,
      viewport: { width: 1365, height: 900 },
      args: ['--disable-blink-features=AutomationControlled'],
    });
    const page: Page = context.pages()[0] || (await context.newPage());
    const browserVersion = context.browser()?.version() || 'chromium';
    const loader = new SessionLoader();

    return {
      provider: 'self_hosted',
      browserVersion,
      // Self-hosted uses screenshot preview stream (no external live URL)
      liveViewUrl: undefined,
      async close() {
        await context.close().catch(() => undefined);
      },
      async captureSecrets() {
        const secrets = await loader.captureFromContext(context, input.portal);
        return {
          encryptedCookies: secrets.encryptedCookies,
          encryptedStorage: secrets.encryptedStorage,
          cookieCount: secrets.cookieCount,
        };
      },
      async currentUrl() {
        return page.url();
      },
      async pageSignals() {
        const url = page.url();
        const body = await page.content().catch(() => '');
        return { url, bodySnippet: body.slice(0, 4000).toLowerCase() };
      },
      async writePreview(absolutePath: string) {
        await fs.mkdir(path.dirname(absolutePath), { recursive: true });
        await page.screenshot({ path: absolutePath, type: 'jpeg', quality: 55 });
      },
      async gotoLogin(loginUrl: string) {
        await page.goto(loginUrl, { waitUntil: 'domcontentloaded' });
      },
    };
  }
}
