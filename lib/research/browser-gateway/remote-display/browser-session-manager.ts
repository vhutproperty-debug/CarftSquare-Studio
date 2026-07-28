import fs from 'fs/promises';
import path from 'path';
import { chromium, type BrowserContext, type Page } from 'playwright';
import { SessionLoader } from '@/lib/research/browser/session-loader';
import { auditRemote } from '@/lib/research/browser-gateway/remote-display/audit';
import {
  allocateDisplayNumber,
  allocatePort,
} from '@/lib/research/browser-gateway/remote-display/ports';
import {
  commandExists,
  killProcessTree,
  spawnDetached,
  waitForPortOpen,
} from '@/lib/research/browser-gateway/remote-display/process-utils';
import {
  registerRemoteSession,
  unregisterRemoteSession,
  getRemoteSessionByConnectId,
} from '@/lib/research/browser-gateway/remote-display/registry';
import {
  buildLiveViewUrl,
  createViewId,
  getWorkerPublicBaseUrl,
  signRemoteViewToken,
  tokenFingerprint,
} from '@/lib/research/browser-gateway/remote-display/signed-url';
import {
  REMOTE_VIEW_TTL_MS,
  type RemoteDisplaySession,
} from '@/lib/research/browser-gateway/remote-display/types';
import { pushWorkerLog } from '@/lib/research/browser-gateway/worker-state';
import type { BrowserLaunchHandle } from '@/lib/research/browser-gateway/types';

export type CreateRemoteSessionInput = {
  connectSessionId: string;
  workspaceId: string;
  portal: string;
  loginUrl: string;
  profileDir: string;
};

/**
 * Browser Session Manager — presentation layer for Railway remote login.
 * Owns per-connect Xvfb + x11vnc + websockify + headed Chromium.
 * Does not change connector encryption/validation contracts.
 */
export class RemoteBrowserSessionManager {
  private readonly active = new Map<string, {
    remote: RemoteDisplaySession;
    context: BrowserContext | null;
    page: Page | null;
    browserCrashRecovered: boolean;
  }>();

  async createSession(input: CreateRemoteSessionInput): Promise<RemoteDisplaySession> {
    const viewId = createViewId();
    const { token, expiresAt, payload } = signRemoteViewToken({
      viewId,
      connectSessionId: input.connectSessionId,
      ttlMs: REMOTE_VIEW_TTL_MS,
    });
    const liveViewUrl = buildLiveViewUrl(viewId, token);
    const publicBase = getWorkerPublicBaseUrl();
    pushWorkerLog(
      'info',
      `live_view_url_resolved connectSessionId=${input.connectSessionId} portal=${input.portal} publicBase=${publicBase} host=${(() => {
        try {
          return new URL(liveViewUrl).origin;
        } catch {
          return 'invalid';
        }
      })()}`,
    );
    if (/127\.0\.0\.1|localhost/i.test(liveViewUrl)) {
      pushWorkerLog(
        'error',
        `live_view_url_localhost_fallback connectSessionId=${input.connectSessionId} — set RESEARCH_BROWSER_WORKER_PUBLIC_URL on the worker`,
      );
    }
    const displayNum = allocateDisplayNumber();
    const vncPort = await allocatePort();
    const websockifyPort = await allocatePort();

    const remote: RemoteDisplaySession = {
      viewId,
      connectSessionId: input.connectSessionId,
      workspaceId: input.workspaceId,
      portal: input.portal,
      display: `:${displayNum}`,
      xvfbPid: null,
      x11vncPid: null,
      websockifyPid: null,
      vncPort,
      websockifyPort,
      liveViewUrl,
      tokenFingerprint: tokenFingerprint(token),
      createdAt: new Date().toISOString(),
      expiresAt: expiresAt.toISOString(),
      destroyed: false,
    };

    registerRemoteSession(remote);
    this.active.set(input.connectSessionId, {
      remote,
      context: null,
      page: null,
      browserCrashRecovered: false,
    });

    auditRemote('session_created', {
      viewId,
      connectSessionId: input.connectSessionId,
      portal: input.portal,
      exp: payload.exp,
      tokenFp: remote.tokenFingerprint,
    });

    // Auto-expire cleanup
    const ttl = expiresAt.getTime() - Date.now();
    setTimeout(() => {
      void this.cleanup(input.connectSessionId, 'ttl_expired');
    }, Math.max(1_000, ttl + 500));

    return remote;
  }

  async launchDisplay(connectSessionId: string): Promise<void> {
    const entry = this.active.get(connectSessionId);
    if (!entry) throw new Error('Remote session not found');
    if (!commandExists('Xvfb')) {
      throw new Error('Xvfb is not installed — required for remote headed Chromium');
    }

    const { remote } = entry;
    pushWorkerLog('info', `display_launch display=${remote.display} portal=${remote.portal}`);
    const xvfb = spawnDetached(
      'Xvfb',
      [remote.display, '-screen', '0', '1365x900x24', '-ac', '+extension', 'GLX', '+render', '-noreset'],
      {},
      `xvfb-${remote.viewId}`,
    );
    remote.xvfbPid = xvfb.pid ?? null;
    await sleep(500);
    if (xvfb.exitCode !== null) {
      throw new Error(`Xvfb exited early with code ${xvfb.exitCode}`);
    }
    auditRemote('display_ready', { viewId: remote.viewId, display: remote.display, pid: remote.xvfbPid });
  }

  async createVncEndpoint(connectSessionId: string): Promise<void> {
    const entry = this.active.get(connectSessionId);
    if (!entry) throw new Error('Remote session not found');
    const { remote } = entry;

    if (!commandExists('x11vnc')) {
      throw new Error('x11vnc is not installed — required for remote browser view');
    }
    if (!commandExists('websockify') && !commandExists('novnc_proxy')) {
      // Debian/Ubuntu often ship websockify as a python module script
      if (!commandExists('python3')) {
        throw new Error('websockify/python3 missing — required for noVNC');
      }
    }

    pushWorkerLog(
      'info',
      `vnc_launch display=${remote.display} vncPort=${remote.vncPort} wsPort=${remote.websockifyPort}`,
    );

    const x11vnc = spawnDetached(
      'x11vnc',
      [
        '-display',
        remote.display,
        '-rfbport',
        String(remote.vncPort),
        '-localhost',
        '-nopw',
        '-shared',
        '-forever',
        '-noxdamage',
        '-wait',
        '10',
        '-defer',
        '10',
      ],
      { DISPLAY: remote.display },
      `x11vnc-${remote.viewId}`,
    );
    remote.x11vncPid = x11vnc.pid ?? null;
    await waitForPortOpen('127.0.0.1', remote.vncPort, 20_000);

    const webRoot = await resolveNovncWebRoot();
    const wsArgs = webRoot
      ? ['--web', webRoot, String(remote.websockifyPort), `localhost:${remote.vncPort}`]
      : [String(remote.websockifyPort), `localhost:${remote.vncPort}`];

    let wsProc;
    if (commandExists('websockify')) {
      wsProc = spawnDetached('websockify', wsArgs, {}, `websockify-${remote.viewId}`);
    } else {
      wsProc = spawnDetached(
        'python3',
        ['-m', 'websockify', ...wsArgs],
        {},
        `websockify-${remote.viewId}`,
      );
    }
    remote.websockifyPid = wsProc.pid ?? null;
    await waitForPortOpen('127.0.0.1', remote.websockifyPort, 20_000);

    auditRemote('vnc_ready', {
      viewId: remote.viewId,
      vncPort: remote.vncPort,
      websockifyPort: remote.websockifyPort,
      webRoot: webRoot || 'none',
    });
  }

  async launchBrowser(input: CreateRemoteSessionInput): Promise<BrowserLaunchHandle> {
    const entry = this.active.get(input.connectSessionId);
    if (!entry) throw new Error('Remote session not found — call createSession first');

    await fs.mkdir(input.profileDir, { recursive: true });
    // Connect authentication is always headed (Xvfb + LiveView/noVNC). Never headless login.
    if (process.env.RESEARCH_CONNECT_HEADLESS === 'true') {
      pushWorkerLog(
        'warn',
        `RESEARCH_CONNECT_HEADLESS ignored for Connect — headed Chromium required connectSessionId=${input.connectSessionId}`,
      );
    }
    const headless = false;
    const display = entry.remote.display;

    pushWorkerLog(
      'info',
      `browser_launch portal=${input.portal} connectSessionId=${input.connectSessionId} headless=${headless} display=${display} profile=${input.profileDir} workerPid=${process.pid}`,
    );

    const context = await this.openContext(input.profileDir, display, headless, input.portal);
    let page = context.pages()[0] || (await context.newPage());
    entry.context = context;
    entry.page = page;
    const browserPid = safeBrowserPid(context);
    pushWorkerLog(
      'info',
      `browser_launch_ok connectSessionId=${input.connectSessionId} portal=${input.portal} browserPid=${browserPid ?? 'n/a'} workerPid=${process.pid} profileDir=${input.profileDir}`,
    );

    context.on('page', (newPage) => {
      entry.page = newPage;
      pushWorkerLog(
        'info',
        `browser_new_page portal=${input.portal} url=${newPage.url()} pages=${context.pages().length}`,
      );
    });
    context.on('close', () => {
      auditRemote('browser_context_closed', { connectSessionId: input.connectSessionId }, 'warn');
    });

    const loader = new SessionLoader();
    const browserVersion = context.browser()?.version() || 'chromium';
    const liveViewUrl = entry.remote.liveViewUrl;

    pushWorkerLog(
      'info',
      `browser_live_view connectSessionId=${input.connectSessionId} portal=${input.portal} headless=${headless} liveView=${liveViewUrl ? 'yes' : 'no'}`,
    );
    auditRemote('browser_ready', {
      viewId: entry.remote.viewId,
      portal: input.portal,
      browserVersion,
    });

    const self = this;

    return {
      provider: 'self_hosted',
      browserVersion,
      liveViewUrl,
      async close() {
        await self.cleanup(input.connectSessionId, 'browser_handle_close');
      },
      async captureSecrets() {
        const ctx = entry.context;
        if (!ctx) throw new Error('Browser context missing during capture');
        const secrets = await loader.captureFromContext(ctx, input.portal);
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
        return (entry.page || page).url();
      },
      async pageSignals(opts) {
        const { collectPageAuthProbe } = await import(
          '@/lib/research/browser-gateway/page-auth-probe'
        );
        const ctx = entry.context || context;
        const openPages = ctx.pages().filter((p) => !p.isClosed());
        pushWorkerLog(
          'info',
          `page_inventory portal=${input.portal} count=${openPages.length} urls=${openPages.map((p) => p.url()).join(' | ') || 'none'}`,
        );
        const p = pickInspectPage(ctx, entry.page || page);
        entry.page = p;
        page = p;
        return collectPageAuthProbe(p, ctx, opts);
      },
      async writePreview(absolutePath: string) {
        await fs.mkdir(path.dirname(absolutePath), { recursive: true });
        const ctx = entry.context || context;
        const p = pickInspectPage(ctx, entry.page || page);
        entry.page = p;
        await p.screenshot({ path: absolutePath, type: 'jpeg', quality: 55 });
      },
      async gotoLogin(loginUrl: string) {
        pushWorkerLog('info', `navigation_start portal=${input.portal} url=${loginUrl}`);
        const target = entry.page || page;
        const ctx = entry.context || context;
        const runNav = async (p: typeof target, c: typeof ctx, jobId: string) => {
          const { instrumentConnectNavigation } = await import(
            '@/lib/research/browser-gateway/connect-debug'
          );
          const { runEnsureConnectLoginSurface } = await import(
            '@/lib/research/browser-gateway/ensure-login-surface'
          );
          const report = await instrumentConnectNavigation({
            page: p,
            context: c,
            portal: input.portal,
            jobId,
            navigationUrl: loginUrl,
            browserId: browserPid != null ? String(browserPid) : null,
          });
          pushWorkerLog(
            'info',
            `navigation_done portal=${input.portal} status=${report.httpStatus ?? 'n/a'} finalUrl=${report.finalUrl} cookies=${report.cookiesCount}`,
          );
          if (report.error) throw new Error(report.error);
          const surfaceShot = report.screenshotAfter5s
            ? report.screenshotAfter5s.replace(/-after-5s\.jpg$/i, '-after-login-surface.jpg')
            : undefined;
          await runEnsureConnectLoginSurface(input.portal, p, {
            screenshotPath: surfaceShot,
          });
          return report;
        };

        try {
          await runNav(target, ctx, input.connectSessionId);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          // Only recover when the browser process/context is actually dead.
          // net::ERR_HTTP_RESPONSE_CODE_FAILURE and WAF blocks are navigation outcomes —
          // closing the context blanks the VNC desktop and looks like a portal mismatch.
          const isBrowserDead =
            /Target closed|browser has been closed|Browser closed|Session closed|has been closed|chromium.*crashed|pipe closed/i.test(
              message,
            );
          if (isBrowserDead && !entry.browserCrashRecovered) {
            entry.browserCrashRecovered = true;
            auditRemote(
              'browser_crash_recover',
              { connectSessionId: input.connectSessionId, error: message },
              'warn',
            );
            pushWorkerLog(
              'warn',
              `browser_crash_recover connectSessionId=${input.connectSessionId} portal=${input.portal} reason=${message.slice(0, 240)}`,
            );
            await entry.context?.close().catch(() => undefined);
            const fresh = await self.openContext(input.profileDir, display, headless, input.portal);
            entry.context = fresh;
            entry.page = fresh.pages()[0] || (await fresh.newPage());
            page = entry.page;
            await runNav(page, fresh, `${input.connectSessionId}-recover`);
            return;
          }
          throw error;
        }
      },
    };
  }

  /** Full bring-up: display → VNC → browser. */
  async startRemoteLogin(input: CreateRemoteSessionInput): Promise<BrowserLaunchHandle> {
    if (this.active.has(input.connectSessionId)) {
      throw new Error(
        `Connect session already active — refusing duplicate browser for ${input.connectSessionId}`,
      );
    }
    await this.createSession(input);
    try {
      await this.launchDisplay(input.connectSessionId);
      await this.createVncEndpoint(input.connectSessionId);
      return await this.launchBrowser(input);
    } catch (error) {
      await this.cleanup(input.connectSessionId, 'start_failed');
      throw error;
    }
  }

  /**
   * Login wait / capture / validate remain in worker-runtime so existing
   * login-detect + connector.validateSession contracts are unchanged.
   * These methods exist so the presentation manager owns the full lifecycle API.
   */
  async waitForLogin(): Promise<never> {
    throw new Error('waitForLogin is orchestrated by worker-runtime (login-detect).');
  }

  /** Return the live Playwright page for an in-flight Connect session (OTP assist). */
  getConnectPage(connectSessionId: string): import('playwright').Page | null {
    const entry = this.active.get(connectSessionId);
    if (!entry) return null;
    if (entry.page && !entry.page.isClosed()) return entry.page;
    // Fall back to any open page on the Connect context (tab swaps / recoveries).
    const open = entry.context?.pages().filter((p) => !p.isClosed()) || [];
    if (open.length) {
      entry.page = open[0];
      return open[0];
    }
    return null;
  }

  async captureSession(handle: BrowserLaunchHandle) {
    return handle.captureSecrets();
  }

  async validateSession(
    validate: () => Promise<{ ok: boolean; status: string; message?: string }>,
  ) {
    return validate();
  }

  async cleanup(connectSessionId: string, reason: string): Promise<void> {
    const entry = this.active.get(connectSessionId);
    const remote = entry?.remote || getRemoteSessionByConnectId(connectSessionId);
    if (!remote || remote.destroyed) {
      this.active.delete(connectSessionId);
      return;
    }
    remote.destroyed = true;
    auditRemote('session_cleanup', {
      viewId: remote.viewId,
      connectSessionId,
      reason,
    });

    if (entry?.context) {
      pushWorkerLog('info', `browser_close portal=${remote.portal} reason=${reason}`);
      await entry.context.close().catch(() => undefined);
      entry.context = null;
      entry.page = null;
    }

    killProcessTree(remote.websockifyPid, `websockify-${remote.viewId}`);
    killProcessTree(remote.x11vncPid, `x11vnc-${remote.viewId}`);
    killProcessTree(remote.xvfbPid, `xvfb-${remote.viewId}`);

    unregisterRemoteSession(remote.viewId);
    this.active.delete(connectSessionId);
  }

  private async openContext(
    profileDir: string,
    display: string,
    headless: boolean,
    portal: string,
  ): Promise<BrowserContext> {
    const { assertPlaywrightRuntimeAllowed } = await import(
      '@/lib/research/browser/playwright-runtime-guard'
    );
    assertPlaywrightRuntimeAllowed('remote-display.openContext');

    const { resolvePortalProxy } = await import('@/lib/research/browser/portal-proxy');
    const proxy = resolvePortalProxy(portal);
    if (proxy) {
      pushWorkerLog('info', `browser_proxy portal=${portal} server=${proxy.server}`);
    }

    // Docker/Railway: no-sandbox + shm flags keep headed Chromium painting on the
    // per-session Xvfb display that x11vnc mirrors (otherwise CDP works but VNC is blank).
    return chromium.launchPersistentContext(profileDir, {
      headless,
      viewport: { width: 1365, height: 900 },
      // Proxy services like scrape.do terminate TLS with their own CA, so the
      // proxied context must accept it. Only relaxed when a proxy is present.
      ...(proxy ? { proxy, ignoreHTTPSErrors: true } : {}),
      args: [
        '--disable-blink-features=AutomationControlled',
        '--no-sandbox',
        '--disable-dev-shm-usage',
        '--window-position=0,0',
        '--window-size=1365,900',
      ],
      env: {
        ...process.env,
        DISPLAY: display,
      },
    });
  }
}

function safeBrowserPid(context: BrowserContext): number | null {
  try {
    const b = context.browser() as { process?: () => { pid?: number } | null } | null;
    if (!b || typeof b.process !== 'function') return null;
    return b.process()?.pid ?? null;
  } catch {
    return null;
  }
}

/** Prefer the tab that looks like the portal profile/login surface. */
function pickInspectPage(ctx: BrowserContext, preferred: Page | null): Page {
  const open = ctx.pages().filter((p) => !p.isClosed());
  if (!open.length) {
    if (preferred && !preferred.isClosed()) return preferred;
    throw new Error('No open browser pages to inspect');
  }
  const ranked = open
    .map((p) => {
      const u = p.url().toLowerCase();
      let score = 0;
      if (/user-profile|my-profile|\/profile|account/.test(u)) score += 6;
      if (/housing\.com|99acres|magicbricks/.test(u)) score += 3;
      if (u && u !== 'about:blank' && !u.startsWith('chrome')) score += 1;
      if (preferred && p === preferred) score += 1;
      return { p, score, u };
    })
    .sort((a, b) => b.score - a.score);
  return ranked[0].p;
}

async function resolveNovncWebRoot(): Promise<string | null> {
  const candidates = [
    '/usr/share/novnc',
    '/usr/share/novnc/web',
    '/usr/share/webapps/novnc',
  ];
  for (const dir of candidates) {
    try {
      await fs.access(path.join(dir, 'vnc.html'));
      return dir;
    } catch {
      /* try next */
    }
  }
  return null;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Singleton used by the self-hosted adapter + HTTP remote routes. */
export const remoteBrowserSessionManager = new RemoteBrowserSessionManager();

/** Spec alias — presentation-layer session manager (not cookie validation manager). */
export { RemoteBrowserSessionManager as BrowserSessionManager };
