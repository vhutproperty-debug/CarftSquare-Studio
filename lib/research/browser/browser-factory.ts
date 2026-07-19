import { chromium, type BrowserContext } from 'playwright';
import { RESEARCH_BROWSER_CONFIG } from '@/lib/research/browser/config';
import { researchPerfLog, researchPerfNow } from '@/lib/research/browser/perf';
import { ensureDir, poolProfileDir } from '@/lib/research/browser/runtime-paths';

const HEAVY_RESOURCE_TYPES = new Set(['image', 'media', 'font']);
const TRACKER_HOST_RE =
  /googletagmanager|google-analytics|doubleclick|facebook\.net|hotjar|taboola|scorecardresearch|adservice|adnxs|rubiconproject|pubmatic/i;

/**
 * Install once per context: drop images/fonts/media + common trackers.
 * Speeds search/validate navigations without changing page DOM structure needed for listings.
 */
export async function installAutomationResourceBlocks(context: BrowserContext): Promise<void> {
  if (!RESEARCH_BROWSER_CONFIG.blockHeavyResources) return;
  await context.route('**/*', (route) => {
    const req = route.request();
    const type = req.resourceType();
    if (HEAVY_RESOURCE_TYPES.has(type)) {
      return route.abort();
    }
    if (TRACKER_HOST_RE.test(req.url())) {
      return route.abort();
    }
    return route.continue();
  });
}

export class BrowserFactory {
  profileDir(workspaceId: string, portal: string): string {
    return poolProfileDir(workspaceId, portal);
  }

  async ensureProfileDir(workspaceId: string, portal: string): Promise<string> {
    const dir = this.profileDir(workspaceId, portal);
    await ensureDir(dir);
    return dir;
  }

  /** Launch Chromium persistent context for workspace + portal isolation. */
  async launchPersistent(workspaceId: string, portal: string): Promise<BrowserContext> {
    const t0 = researchPerfNow();
    const userDataDir = await this.ensureProfileDir(workspaceId, portal);
    const context = await chromium.launchPersistentContext(userDataDir, {
      headless: RESEARCH_BROWSER_CONFIG.headless,
      viewport: { width: 1365, height: 900 },
      args: ['--disable-blink-features=AutomationControlled'],
    });
    context.setDefaultTimeout(RESEARCH_BROWSER_CONFIG.defaultTimeoutMs);
    context.setDefaultNavigationTimeout(RESEARCH_BROWSER_CONFIG.navigationTimeoutMs);
    await installAutomationResourceBlocks(context);
    researchPerfLog('browser_startup', t0, { workspaceId, portal, warm: false });
    return context;
  }
}
