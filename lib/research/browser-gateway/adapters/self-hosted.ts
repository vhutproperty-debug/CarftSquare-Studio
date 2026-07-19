import fs from 'fs/promises';
import path from 'path';
import { chromium, type BrowserContext, type Page } from 'playwright';
import { SessionLoader } from '@/lib/research/browser/session-loader';
import { remoteBrowserSessionManager } from '@/lib/research/browser-gateway/remote-display/browser-session-manager';
import { commandExists } from '@/lib/research/browser-gateway/remote-display/process-utils';
import type { BrowserLaunchHandle, BrowserProviderAdapter } from '@/lib/research/browser-gateway/types';
import { pushWorkerLog } from '@/lib/research/browser-gateway/worker-state';

/**
 * Self-hosted / Docker Playwright adapter.
 * On Railway (Xvfb + x11vnc + noVNC available): remote secure login window.
 * Local fallback without Xvfb: headed/headless Chromium + screenshot preview only.
 */
export class SelfHostedBrowserAdapter implements BrowserProviderAdapter {
  readonly kind = 'self_hosted' as const;

  async launchLoginSession(input: {
    workspaceId: string;
    portal: string;
    loginUrl: string;
    profileDir: string;
    connectSessionId?: string;
  }): Promise<BrowserLaunchHandle> {
    const connectSessionId =
      input.connectSessionId ||
      `anon-${input.workspaceId}-${input.portal}-${Date.now()}`;

    const canRemote =
      process.platform !== 'win32' &&
      commandExists('Xvfb') &&
      commandExists('x11vnc') &&
      (commandExists('websockify') || commandExists('python3'));

    if (canRemote) {
      pushWorkerLog(
        'info',
        `self_hosted_remote portal=${input.portal} connectSessionId=${connectSessionId}`,
      );
      return remoteBrowserSessionManager.startRemoteLogin({
        connectSessionId,
        workspaceId: input.workspaceId,
        portal: input.portal,
        loginUrl: input.loginUrl,
        profileDir: input.profileDir,
      });
    }

    pushWorkerLog(
      'warn',
      `self_hosted_local_fallback portal=${input.portal} — Xvfb/noVNC unavailable; using local Chromium preview only`,
    );
    return launchLocalFallback(input);
  }
}

async function launchLocalFallback(input: {
  workspaceId: string;
  portal: string;
  loginUrl: string;
  profileDir: string;
}): Promise<BrowserLaunchHandle> {
  // Caller prepares a fresh profileDir; ensure parents exist.
  await fs.mkdir(input.profileDir, { recursive: true });
  const headless = process.env.RESEARCH_CONNECT_HEADLESS === 'true';
  const context: BrowserContext = await chromium.launchPersistentContext(input.profileDir, {
    headless,
    viewport: { width: 1365, height: 900 },
    args: ['--disable-blink-features=AutomationControlled'],
  });
  const page: Page = context.pages()[0] || (await context.newPage());
  const browserVersion = context.browser()?.version() || 'chromium';
  const browserPid = (() => {
    try {
      const b = context.browser() as { process?: () => { pid?: number } | null } | null;
      return typeof b?.process === 'function' ? b.process()?.pid ?? null : null;
    } catch {
      return null;
    }
  })();
  pushWorkerLog(
    'info',
    `browser_launch_ok portal=${input.portal} browserPid=${browserPid ?? 'n/a'} workerPid=${process.pid} profileDir=${input.profileDir} mode=local_fallback`,
  );
  const loader = new SessionLoader();

  return {
    provider: 'self_hosted',
    browserVersion,
    liveViewUrl: undefined,
    async close() {
      pushWorkerLog('info', `browser_close portal=${input.portal}`);
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
    async pageSignals(opts) {
      const { collectPageAuthProbe } = await import(
        '@/lib/research/browser-gateway/page-auth-probe'
      );
      return collectPageAuthProbe(page, context, opts);
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
