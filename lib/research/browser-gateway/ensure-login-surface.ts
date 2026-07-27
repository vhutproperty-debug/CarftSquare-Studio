/**
 * After Connect navigation, optionally open portal login modal via connector hook.
 */
import fs from 'fs/promises';
import path from 'path';
import type { Page } from 'playwright';
import { pushWorkerLog } from '@/lib/research/browser-gateway/worker-state';

export async function runEnsureConnectLoginSurface(
  portal: string,
  page: Page,
  opts?: { screenshotPath?: string },
): Promise<void> {
  try {
    const { getPortalConnector } = await import('@/connectors/registry');
    const connector = getPortalConnector(portal);
    if (!connector || typeof connector.ensureConnectLoginSurface !== 'function') {
      return;
    }
    pushWorkerLog('info', `connect_login_surface_start portal=${portal}`);
    await connector.ensureConnectLoginSurface(page);
    pushWorkerLog(
      'info',
      `connect_login_surface_done portal=${portal} url=${page.url()}`,
    );
    if (opts?.screenshotPath) {
      await fs.mkdir(path.dirname(opts.screenshotPath), { recursive: true }).catch(() => undefined);
      await page
        .screenshot({ path: opts.screenshotPath, type: 'jpeg', quality: 55 })
        .catch(() => undefined);
      pushWorkerLog(
        'info',
        `connect_login_surface_screenshot portal=${portal} path=${opts.screenshotPath}`,
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    pushWorkerLog('warn', `connect_login_surface_failed portal=${portal} error=${message}`);
    throw error;
  }
}
