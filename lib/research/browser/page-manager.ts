import type { BrowserContext, Page } from 'playwright';
import { RESEARCH_BROWSER_CONFIG } from '@/lib/research/browser/config';
import { ScreenshotManager } from '@/lib/research/browser/screenshot-manager';

export class PageManager {
  private readonly screenshots = new ScreenshotManager();

  async open(context: BrowserContext): Promise<Page> {
    const page = await context.newPage();
    page.setDefaultTimeout(RESEARCH_BROWSER_CONFIG.defaultTimeoutMs);
    page.setDefaultNavigationTimeout(RESEARCH_BROWSER_CONFIG.navigationTimeoutMs);
    return page;
  }

  async goto(page: Page, url: string): Promise<import('playwright').Response | null> {
    return page.goto(url, { waitUntil: 'domcontentloaded' });
  }

  async safeClose(page: Page | null | undefined): Promise<void> {
    if (!page) return;
    try {
      await page.close();
    } catch {
      /* ignore */
    }
  }

  async withPage<T>(
    context: BrowserContext,
    label: string,
    fn: (page: Page) => Promise<T>,
  ): Promise<{ result?: T; screenshotPath?: string; error?: Error }> {
    const page = await this.open(context);
    try {
      const result = await fn(page);
      return { result };
    } catch (error) {
      const screenshotPath = await this.screenshots.captureFailure(page, label);
      return {
        screenshotPath,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    } finally {
      await this.safeClose(page);
    }
  }
}
