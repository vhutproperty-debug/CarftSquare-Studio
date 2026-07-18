import fs from 'fs/promises';
import path from 'path';
import type { Page } from 'playwright';
import { RESEARCH_BROWSER_CONFIG } from '@/lib/research/browser/config';

export class ScreenshotManager {
  async captureFailure(page: Page, label: string): Promise<string | undefined> {
    try {
      await fs.mkdir(RESEARCH_BROWSER_CONFIG.screenshotRoot, { recursive: true });
      const safe = label.replace(/[^a-z0-9-_]+/gi, '_').slice(0, 60);
      const filePath = path.join(
        RESEARCH_BROWSER_CONFIG.screenshotRoot,
        `${Date.now()}-${safe}.png`,
      );
      await page.screenshot({ path: filePath, fullPage: true });
      return filePath;
    } catch (error) {
      console.warn(
        '[research-browser] screenshot_failed',
        error instanceof Error ? error.message : error,
      );
      return undefined;
    }
  }
}
