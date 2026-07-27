import { v4 as uuidv4 } from 'uuid';
import type { Page } from 'playwright';
import { connectorRuntime } from '@/connectors/common/connector-runtime';
import type {
  LoginConfidenceResult,
  LoginConfidenceSignal,
} from '@/connectors/common/login-confidence';
import type { PortalConnector } from '@/connectors/common/portal-connector';
import { connectorLog } from '@/lib/research/browser/connector-log';
import { researchBrowserManager } from '@/lib/research/browser/browser-manager';
import { getPortalMeta, RESEARCH_BROWSER_CONFIG } from '@/lib/research/browser/config';
import { researchPerfLog, researchPerfNow } from '@/lib/research/browser/perf';
import { isServerlessPlaywrightHost } from '@/lib/research/browser/playwright-runtime-guard';
import { recordResearchSearch } from '@/lib/research/ops/metrics';
import {
  clearPortalDegraded,
  markPortalDegraded,
  shouldDegradeOnEmptyExtract,
} from '@/lib/research/ops/portal-degradation';
import { browserSessionManager } from '@/lib/research/sessions/browser-session-manager';
import { touchBrowserSession } from '@/lib/research/sessions/session-store';
import {
  findPortalConnection,
  upsertPortalConnection,
} from '@/lib/research/store/portal-connections';
import type {
  ConnectorSearchRequest,
  ConnectorSearchResponse,
  ResearchListing,
  ResearchPortalConnection,
} from '@/lib/research/types';

/** Prefer listing anchors over waiting for analytics-driven networkidle. */
const LISTING_READY_SELECTOR =
  'a[href*="property"], a[href*="/rent"], a[href*="/buy"], a[href*="flat"], a[href*="apartment"], a[href*="resale"]';

/**
 * Production BaseConnector — owns browser/session lifecycle via BrowserManager + ConnectorRuntime.
 * Portal subclasses only supply login URL, optional auth extras, search URL, and extractors.
 *
 * Interactive login (OTP) remains on the Connect / Browser Worker remote-display path;
 * `performLogin` documents that contract and must not launch ad-hoc browsers.
 */
export abstract class BasePortalConnector implements PortalConnector {
  abstract readonly key: string;
  abstract readonly displayName: string;

  /** Portal login / OTP entry URL (may show a login form). */
  getLoginUrl(): string {
    const meta = getPortalMeta(this.key);
    if (!meta?.loginUrl) throw new Error(`No loginUrl configured for portal ${this.key}`);
    return meta.loginUrl;
  }

  /** Post-auth verification URL — never a login-only page. */
  getVerifyUrl(): string {
    const meta = getPortalMeta(this.key);
    if (!meta?.verifyUrl) throw new Error(`No verifyUrl configured for portal ${this.key}`);
    return meta.verifyUrl;
  }

  /**
   * Optional Connect post-navigation: open modal / ensure OTP UI is visible.
   * Default no-op — portals with homepage modals override (e.g. NoBroker).
   */
  async ensureConnectLoginSurface(_page: Page): Promise<void> {
    /* no-op */
  }

  /**
   * Interactive login is performed via Research Connect (remote headed browser).
   * Portal subclasses must not spawn their own Chromium for OTP flows.
   */
  async performLogin(_workspaceId: string): Promise<never> {
    throw new Error(
      `${this.displayName}: use Research Connectors → Connect for interactive login. ` +
        `BaseConnector does not own the remote login UI.`,
    );
  }

  /** Portal-specific DOM auth extras (optional). */
  protected async portalAuthExtraSignals(_page: Page): Promise<LoginConfidenceSignal[]> {
    return [];
  }

  /** Multi-signal login check via AuthEvidenceEngine — never URL-only. */
  async isLoggedIn(page: Page): Promise<LoginConfidenceResult> {
    const { evaluatePageAuth } = await import(
      '@/lib/research/auth-detection/auth-evidence-engine'
    );
    const result = await evaluatePageAuth(page, {
      portal: this.key,
      mode: 'verify',
      verifyUrl: this.getVerifyUrl(),
    });
    return {
      authenticated: result.authenticated,
      confidence: result.confidence,
      threshold: result.threshold,
      signals: result.signals.map((s) => ({
        name: s.id,
        pass: s.pass,
        weight: s.maxPoints,
        detail: s.detail,
      })),
      summary: result.summary,
    };
  }

  protected abstract buildSearchUrl(criteria: ConnectorSearchRequest['criteria']): string;
  protected abstract parseListingsFromPage(page: Page, portal: string): Promise<ResearchListing[]>;

  async connect(workspaceId: string): Promise<ResearchPortalConnection> {
    connectorLog(this.key, 'connect', { workspaceId });
    connectorRuntime.reset(workspaceId, this.key);
    connectorRuntime.transition(workspaceId, this.key, 'open_browser');
    await browserSessionManager.getOrCreate(workspaceId, this.key);
    connectorRuntime.transition(workspaceId, this.key, 'load_persistent_profile');
    const connection = await upsertPortalConnection({
      workspaceId,
      portalKey: this.key,
      portalName: this.displayName,
      status: 'pending',
      lastError: null,
    });
    return connection;
  }

  async validateSession(workspaceId: string): Promise<{
    ok: boolean;
    status: string;
    message?: string;
    sessionId?: string;
    httpStatus?: number | null;
    responseKind?: string;
    loginConfidence?: number;
  }> {
    connectorLog(this.key, 'validateSession', { workspaceId });

    if (isServerlessPlaywrightHost()) {
      const { requestWorkerValidateSession } = await import(
        '@/lib/research/browser-gateway/worker-client'
      );
      const result = await requestWorkerValidateSession({
        workspaceId,
        portal: this.key,
      });
      connectorLog(this.key, 'validateSession_worker', {
        ok: result.ok,
        status: result.status,
        message: result.message,
      });
      return result;
    }

    const session = await browserSessionManager.getOrCreate(workspaceId, this.key);
    try {
      const current = connectorRuntime.snapshot(workspaceId, this.key).state;
      if (current === 'disconnected') {
        connectorRuntime.transition(workspaceId, this.key, 'open_browser');
        connectorRuntime.transition(workspaceId, this.key, 'load_persistent_profile');
      }
      connectorRuntime.transition(workspaceId, this.key, 'restore_session');
      connectorRuntime.transition(workspaceId, this.key, 'verify_login');
      const result = await browserSessionManager.validateSession(session.id, { force: true });
      const portalStatus = result.ok
        ? 'connected'
        : result.status === 'needs_login' || result.status === 'expired'
          ? 'pending'
          : 'error';
      await upsertPortalConnection({
        workspaceId,
        portalKey: this.key,
        portalName: this.displayName,
        status: portalStatus,
        lastError: result.ok ? null : result.message || `Validation failed (${result.status})`,
      });
      if (result.ok) {
        connectorRuntime.transition(workspaceId, this.key, 'ready');
        connectorRuntime.transition(workspaceId, this.key, 'idle');
      } else {
        connectorRuntime.markFailure(
          workspaceId,
          this.key,
          result.message || result.status,
          result.status === 'needs_login'
            ? 'Reconnect this portal and complete login in the secure browser.'
            : 'Retry validation; if browser crashed, recovery will reopen the context.',
        );
      }
      connectorLog(this.key, 'validateSession_result', {
        ok: result.ok,
        status: result.status,
        httpStatus: result.httpStatus,
        responseKind: result.responseKind,
        loginConfidence: result.loginConfidence,
        message: result.message,
      });
      return { ...result, sessionId: session.id };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      connectorLog(this.key, 'validateSession_exception', { error: message }, 'error');
      await this.recoverBrowser(workspaceId, message);
      await upsertPortalConnection({
        workspaceId,
        portalKey: this.key,
        portalName: this.displayName,
        status: 'error',
        lastError: message,
      });
      return { ok: false, status: 'error', message, sessionId: session.id };
    }
  }

  async executeSearch(request: ConnectorSearchRequest): Promise<ConnectorSearchResponse> {
    if (isServerlessPlaywrightHost()) {
      const { requestWorkerExecuteSearch } = await import(
        '@/lib/research/browser-gateway/worker-client'
      );
      return requestWorkerExecuteSearch({
        workspaceId: request.workspaceId,
        portal: this.key,
        criteria: request.criteria,
        sessionId: request.sessionId,
        skipValidation: request.skipValidation,
      });
    }

    const tSearch = researchPerfNow();
    const workspaceId = request.workspaceId;
    const session = await browserSessionManager.getOrCreate(workspaceId, this.key);

    if (!request.skipValidation) {
      const validation = await browserSessionManager.validateSession(session.id);
      if (!validation.ok) {
        connectorRuntime.markFailure(
          workspaceId,
          this.key,
          validation.message || validation.status,
          'Reconnect portal before searching.',
        );
        recordResearchSearch(false);
        return {
          ok: false,
          listings: [],
          sessionStatus: validation.status,
          message: validation.message || 'Portal session is not authenticated.',
        };
      }
    } else if (session.sessionStatus !== 'valid' || !session.encryptedCookies) {
      recordResearchSearch(false);
      return {
        ok: false,
        listings: [],
        sessionStatus: session.sessionStatus || 'needs_login',
        message: 'Portal session is not authenticated.',
      };
    }

    const searchUrl = this.buildSearchUrl(request.criteria);
    connectorLog(this.key, 'executeSearch_url', {
      searchUrl,
      workspaceId,
    });
    connectorRuntime.transition(workspaceId, this.key, 'searching');

    const outcome = await researchBrowserManager.withPage(
      session,
      `search-${this.key}`,
      async (page) => {
        const tNav = researchPerfNow();
        await page.goto(searchUrl, { waitUntil: 'domcontentloaded' });
        await page
          .waitForSelector(LISTING_READY_SELECTOR, { timeout: 2_500 })
          .catch(() => undefined);
        researchPerfLog('search_navigation', tNav, { portal: this.key });
        const tExtract = researchPerfNow();
        const listings = await this.parseListingsFromPage(page, this.key);
        researchPerfLog('result_extraction', tExtract, {
          portal: this.key,
          count: listings.length,
        });
        return listings;
      },
    );

    if (outcome.error) {
      const message = outcome.error.message;
      const recovered = await this.recoverBrowser(workspaceId, message);
      connectorRuntime.markSearch(workspaceId, this.key, false);
      recordResearchSearch(false);
      return {
        ok: false,
        listings: [],
        sessionStatus: 'error',
        message: recovered
          ? `${message} (browser recovered — retry search)`
          : message,
        screenshotPath: outcome.screenshotPath,
      };
    }

    const listings = outcome.result || [];
    const lastVerifiedMs = session.lastVerified
      ? Date.now() - new Date(session.lastVerified).getTime()
      : Number.POSITIVE_INFINITY;
    if (lastVerifiedMs >= RESEARCH_BROWSER_CONFIG.renewMinIntervalMs) {
      await browserSessionManager.renew(session.id).catch(() => undefined);
    }

    // Graceful degradation: empty extract ≠ auth failure.
    if (listings.length === 0) {
      const verdict = shouldDegradeOnEmptyExtract({});
      if (verdict.degrade) {
        const deg = markPortalDegraded(this.key, verdict.reason);
        connectorLog(this.key, 'portal_degraded_empty_extract', {
          consecutiveEmpty: deg.consecutiveEmpty,
          reason: deg.reason,
        }, 'warn');
        await touchBrowserSession(session.id, {
          extractorDegraded: true,
          extractorDegradationReason: deg.reason,
          extractorDegradedAt: deg.at,
        }).catch(() => undefined);
        connectorRuntime.markSearch(workspaceId, this.key, true);
        connectorRuntime.transition(workspaceId, this.key, 'idle');
        recordResearchSearch(false);
        researchPerfLog('execute_search_total', tSearch, {
          portal: this.key,
          listings: 0,
          degraded: true,
        });
        return {
          ok: true,
          listings: [],
          sessionStatus: 'valid',
          degraded: true,
          degradationReason: deg.reason,
          message: deg.reason,
        };
      }
    } else {
      clearPortalDegraded(this.key);
      if (session.extractorDegraded) {
        await touchBrowserSession(session.id, {
          extractorDegraded: false,
          extractorDegradationReason: null,
          extractorDegradedAt: null,
        }).catch(() => undefined);
      }
    }

    connectorRuntime.markSearch(workspaceId, this.key, true);
    connectorRuntime.transition(workspaceId, this.key, 'idle');
    recordResearchSearch(listings.length > 0);

    researchPerfLog('execute_search_total', tSearch, {
      portal: this.key,
      listings: listings.length,
    });
    return {
      ok: true,
      listings,
      sessionStatus: 'valid',
    };
  }

  /**
   * Fatal browser failure recovery: close context → reopen profile → ready for re-validate.
   * Does not invent credentials; caller must re-validate if cookies are still present.
   */
  async recoverBrowser(workspaceId: string, reason: string): Promise<boolean> {
    connectorLog(this.key, 'browser_recover_start', { reason }, 'warn');
    try {
      connectorRuntime.markFailure(
        workspaceId,
        this.key,
        reason,
        'Automatic browser restart in progress; re-validate session.',
      );
      connectorRuntime.transition(workspaceId, this.key, 'close_context');
      connectorRuntime.transition(workspaceId, this.key, 'close_browser');
      await researchBrowserManager.cleanup(workspaceId, this.key);
      connectorRuntime.transition(workspaceId, this.key, 'open_new_browser');
      connectorRuntime.transition(workspaceId, this.key, 'restore_profile');
      // Warm path recreates persistent context on next withPage / validate.
      connectorLog(this.key, 'browser_recover_done', { reason });
      return true;
    } catch (error) {
      connectorLog(
        this.key,
        'browser_recover_failed',
        { error: error instanceof Error ? error.message : String(error) },
        'error',
      );
      return false;
    }
  }

  async collectListings(request: ConnectorSearchRequest): Promise<ResearchListing[]> {
    const response = await this.executeSearch(request);
    return response.listings;
  }

  async extract(input: {
    html?: string;
    text?: string;
    url?: string;
  }): Promise<Record<string, unknown>> {
    const text = input.text || input.html || '';
    const rentMatch = text.match(/(?:₹|rs\.?)\s*([\d,.]+)\s*(k|lakh|lac|l)?/i);
    let rent: number | undefined;
    if (rentMatch) {
      const n = Number(rentMatch[1].replace(/,/g, ''));
      const unit = (rentMatch[2] || '').toLowerCase();
      if (Number.isFinite(n)) {
        rent = unit.startsWith('l') ? n * 100_000 : unit === 'k' ? n * 1000 : n;
      }
    }
    const bhkMatch = text.match(/(\d(?:\.\d)?)\s*bhk/i);
    return {
      url: input.url,
      rent,
      bhk: bhkMatch ? Number(bhkMatch[1]) : undefined,
      snippet: text.replace(/\s+/g, ' ').trim().slice(0, 280),
    };
  }

  async disconnect(workspaceId: string): Promise<void> {
    const existing = await findPortalConnection(workspaceId, this.key);
    if (existing) {
      await upsertPortalConnection({
        workspaceId,
        portalKey: this.key,
        portalName: this.displayName,
        status: 'disconnected',
      });
    }
    await researchBrowserManager.cleanup(workspaceId, this.key);
    const session = await browserSessionManager.getOrCreate(workspaceId, this.key);
    await browserSessionManager.expire(session.id);
    connectorRuntime.reset(workspaceId, this.key);
  }

  async healthCheck(workspaceIdOrConnectionId?: string): Promise<{
    ok: boolean;
    message?: string;
    runtime?: ReturnType<typeof connectorRuntime.snapshot>;
  }> {
    const workspaceId =
      workspaceIdOrConnectionId && workspaceIdOrConnectionId !== 'health-monitor'
        ? workspaceIdOrConnectionId
        : 'workspace-default';
    const meta = getPortalMeta(this.key);
    const runtime = connectorRuntime.snapshot(workspaceId, this.key);
    const healthyStates = new Set([
      'ready',
      'idle',
      'searching',
      'health_check',
      'disconnected',
      'load_persistent_profile',
      'restore_session',
      'verify_login',
      'restore_profile',
    ]);
    const ok = Boolean(meta) && healthyStates.has(runtime.state);
    return {
      ok,
      message: meta
        ? `${this.displayName} state=${runtime.state} confidence=${runtime.loginConfidence ?? 'n/a'} recoveries=${runtime.recoveryAttempts}`
        : 'Unknown portal',
      runtime,
    };
  }

  getRuntime(workspaceId: string) {
    return connectorRuntime.snapshot(workspaceId, this.key);
  }

  protected listingId(portal: string, url?: string): string {
    return `${portal}:${url || uuidv4()}`;
  }
}
