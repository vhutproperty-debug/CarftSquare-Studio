import { v4 as uuidv4 } from 'uuid';
import type { Page } from 'playwright';
import { connectorLog } from '@/lib/research/browser/connector-log';
import { researchBrowserManager } from '@/lib/research/browser/browser-manager';
import { getPortalMeta } from '@/lib/research/browser/config';
import { browserSessionManager } from '@/lib/research/sessions/browser-session-manager';
import {
  findPortalConnection,
  upsertPortalConnection,
} from '@/lib/research/store/portal-connections';
import type { PortalConnector } from '@/connectors/common/portal-connector';
import type {
  ConnectorSearchRequest,
  ConnectorSearchResponse,
  ResearchListing,
  ResearchPortalConnection,
} from '@/lib/research/types';

export abstract class BasePortalConnector implements PortalConnector {
  abstract readonly key: string;
  abstract readonly displayName: string;

  protected abstract buildSearchUrl(criteria: ConnectorSearchRequest['criteria']): string;
  protected abstract parseListingsFromPage(page: Page, portal: string): Promise<ResearchListing[]>;

  async connect(workspaceId: string): Promise<ResearchPortalConnection> {
    connectorLog(this.key, 'connect', { workspaceId });
    const session = await browserSessionManager.getOrCreate(workspaceId, this.key);
    const connection = await upsertPortalConnection({
      workspaceId,
      portalKey: this.key,
      portalName: this.displayName,
      status: session.encryptedCookies ? 'connected' : 'pending',
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
  }> {
    connectorLog(this.key, 'validateSession', { workspaceId });
    const session = await browserSessionManager.getOrCreate(workspaceId, this.key);
    try {
      const result = await browserSessionManager.validateSession(session.id);
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
      connectorLog(this.key, 'validateSession_result', {
        ok: result.ok,
        status: result.status,
        httpStatus: result.httpStatus,
        responseKind: result.responseKind,
        message: result.message,
      });
      return { ...result, sessionId: session.id };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      connectorLog(this.key, 'validateSession_exception', { error: message }, 'error');
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
    const session = await browserSessionManager.getOrCreate(request.workspaceId, this.key);
    const validation = await browserSessionManager.validateSession(session.id);
    if (!validation.ok) {
      return {
        ok: false,
        listings: [],
        sessionStatus: validation.status,
        message: validation.message || 'Portal session is not authenticated.',
      };
    }

    const searchUrl = this.buildSearchUrl(request.criteria);
    const outcome = await researchBrowserManager.withPage(
      session,
      `search-${this.key}`,
      async (page) => {
        await page.goto(searchUrl, { waitUntil: 'domcontentloaded' });
        await page.waitForLoadState('networkidle', { timeout: 8_000 }).catch(() => undefined);
        return this.parseListingsFromPage(page, this.key);
      },
    );

    if (outcome.error) {
      return {
        ok: false,
        listings: [],
        sessionStatus: 'error',
        message: outcome.error.message,
        screenshotPath: outcome.screenshotPath,
      };
    }

    await browserSessionManager.renew(session.id).catch(() => undefined);
    return {
      ok: true,
      listings: outcome.result || [],
      sessionStatus: 'valid',
    };
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
  }

  async healthCheck(): Promise<{ ok: boolean; message?: string }> {
    const meta = getPortalMeta(this.key);
    return {
      ok: Boolean(meta),
      message: meta ? `${this.displayName} connector ready` : 'Unknown portal',
    };
  }

  protected listingId(portal: string, url?: string): string {
    return `${portal}:${url || uuidv4()}`;
  }
}
