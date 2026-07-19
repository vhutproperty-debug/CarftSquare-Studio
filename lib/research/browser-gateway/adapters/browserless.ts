import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import { SessionLoader } from '@/lib/research/browser/session-loader';
import type { BrowserLaunchHandle, BrowserProviderAdapter } from '@/lib/research/browser-gateway/types';

/**
 * Browserless.io adapter — connects via CDP WebSocket.
 * Configure RESEARCH_BROWSERLESS_WS (e.g. wss://chrome.browserless.io?token=…).
 */
export class BrowserlessAdapter implements BrowserProviderAdapter {
  readonly kind = 'browserless' as const;

  async launchLoginSession(input: {
    workspaceId: string;
    portal: string;
    loginUrl: string;
    profileDir: string;
  }): Promise<BrowserLaunchHandle> {
    const ws = process.env.RESEARCH_BROWSERLESS_WS;
    if (!ws) {
      throw new Error('RESEARCH_BROWSERLESS_WS is not configured.');
    }
    void input.profileDir;
    const browser: Browser = await chromium.connectOverCDP(ws);
    const context: BrowserContext =
      browser.contexts()[0] || (await browser.newContext({ viewport: { width: 1365, height: 900 } }));
    const page: Page = context.pages()[0] || (await context.newPage());
    const loader = new SessionLoader();
    const liveViewUrl = process.env.RESEARCH_BROWSERLESS_LIVE_URL || undefined;

    return {
      provider: 'browserless',
      browserVersion: browser.version(),
      liveViewUrl,
      async close() {
        await browser.close().catch(() => undefined);
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
        await page.screenshot({ path: absolutePath, type: 'jpeg', quality: 55 });
      },
      async gotoLogin(loginUrl: string) {
        await page.goto(loginUrl, { waitUntil: 'domcontentloaded' });
      },
    };
  }
}
