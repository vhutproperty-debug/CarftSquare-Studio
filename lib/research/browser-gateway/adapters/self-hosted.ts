import fs from 'fs/promises';
import path from 'path';
import { chromium, type BrowserContext, type Page } from 'playwright';
import { SessionLoader } from '@/lib/research/browser/session-loader';
import type { BrowserLaunchHandle, BrowserProviderAdapter } from '@/lib/research/browser-gateway/types';
import { pushWorkerLog } from '@/lib/research/browser-gateway/worker-state';

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
    // Headed by default — Housing Akamai returns HTTP 406 to headless Chromium.
    // Only RESEARCH_CONNECT_HEADLESS=true forces headless for connect.
    const headless = process.env.RESEARCH_CONNECT_HEADLESS === 'true';
    pushWorkerLog(
      'info',
      `browser_launch portal=${input.portal} headless=${headless} profile=${input.profileDir}`,
    );

    const context: BrowserContext = await chromium.launchPersistentContext(input.profileDir, {
      headless,
      viewport: { width: 1365, height: 900 },
      args: ['--disable-blink-features=AutomationControlled'],
    });
    pushWorkerLog('info', `browser_launch_ok portal=${input.portal} headless=${headless}`);

    const existing = context.pages();
    const page: Page = existing[0] || (await context.newPage());
    pushWorkerLog(
      'info',
      `page_create portal=${input.portal} pages=${context.pages().length} reused=${Boolean(existing[0])}`,
    );

    const browserVersion = context.browser()?.version() || 'chromium';
    const loader = new SessionLoader();

    return {
      provider: 'self_hosted',
      browserVersion,
      // Self-hosted uses screenshot preview stream (no external live URL)
      liveViewUrl: undefined,
      async close() {
        pushWorkerLog('info', `browser_close portal=${input.portal}`);
        await context.close().catch(() => undefined);
      },
      async captureSecrets() {
        const secrets = await loader.captureFromContext(context, input.portal);
        pushWorkerLog(
          'info',
          `capture_secrets portal=${input.portal} cookieCount=${secrets.cookieCount ?? 0}`,
        );
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
        const cookies = await context.cookies().catch(() => []);
        return {
          url,
          bodySnippet: body.slice(0, 4000).toLowerCase(),
          cookieCount: cookies.length,
        };
      },
      async writePreview(absolutePath: string) {
        await fs.mkdir(path.dirname(absolutePath), { recursive: true });
        await page.screenshot({ path: absolutePath, type: 'jpeg', quality: 55 });
      },
      async gotoLogin(loginUrl: string) {
        pushWorkerLog('info', `navigation_start portal=${input.portal} url=${loginUrl}`);
        const response = await page.goto(loginUrl, { waitUntil: 'domcontentloaded' });
        pushWorkerLog(
          'info',
          `navigation_done portal=${input.portal} status=${response?.status() ?? 'n/a'} finalUrl=${page.url()}`,
        );
      },
    };
  }
}
