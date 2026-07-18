import fs from 'fs/promises';
import path from 'path';
import { chromium, type BrowserContext } from 'playwright';
import { RESEARCH_BROWSER_CONFIG } from '@/lib/research/browser/config';

export class BrowserFactory {
  profileDir(workspaceId: string, portal: string): string {
    return path.join(RESEARCH_BROWSER_CONFIG.profileRoot, workspaceId, portal);
  }

  async ensureProfileDir(workspaceId: string, portal: string): Promise<string> {
    const dir = this.profileDir(workspaceId, portal);
    await fs.mkdir(dir, { recursive: true });
    return dir;
  }

  /** Launch Chromium persistent context for workspace + portal isolation. */
  async launchPersistent(workspaceId: string, portal: string): Promise<BrowserContext> {
    const userDataDir = await this.ensureProfileDir(workspaceId, portal);
    const context = await chromium.launchPersistentContext(userDataDir, {
      headless: RESEARCH_BROWSER_CONFIG.headless,
      viewport: { width: 1365, height: 900 },
      args: ['--disable-blink-features=AutomationControlled'],
    });
    context.setDefaultTimeout(RESEARCH_BROWSER_CONFIG.defaultTimeoutMs);
    context.setDefaultNavigationTimeout(RESEARCH_BROWSER_CONFIG.navigationTimeoutMs);
    return context;
  }
}
