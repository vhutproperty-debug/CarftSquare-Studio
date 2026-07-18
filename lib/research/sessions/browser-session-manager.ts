import type { SessionManager } from '@/agents/session-manager';
import { researchBrowserManager } from '@/lib/research/browser/browser-manager';
import { getPortalMeta } from '@/lib/research/browser/config';
import { PageManager } from '@/lib/research/browser/page-manager';
import {
  findBrowserSession,
  getBrowserSessionById,
  listBrowserSessions,
  markBrowserSessionExpired,
  touchBrowserSession,
  upsertBrowserSession,
} from '@/lib/research/sessions/session-store';
import type { ResearchBrowserSession, ResearchBrowserSessionStatus } from '@/lib/research/types';

/**
 * Production Browser Session Manager — persistent profiles, encrypted secrets,
 * validation, refresh, multi-portal + workspace isolation.
 */
export class BrowserSessionManager implements SessionManager {
  readonly name = 'SessionManager' as const;
  private readonly pages = new PageManager();

  async get(sessionId: string): Promise<ResearchBrowserSession | null> {
    return getBrowserSessionById(sessionId);
  }

  async list(workspaceId: string): Promise<ResearchBrowserSession[]> {
    return listBrowserSessions(workspaceId);
  }

  async getOrCreate(workspaceId: string, portal: string): Promise<ResearchBrowserSession> {
    const existing = await findBrowserSession(workspaceId, portal);
    if (existing) return existing;
    const browserProfile = researchBrowserManager.profilePath(workspaceId, portal);
    return upsertBrowserSession({
      workspaceId,
      portal,
      browserProfile,
      sessionStatus: 'needs_login',
    });
  }

  async renew(sessionId: string): Promise<ResearchBrowserSession> {
    const session = await getBrowserSessionById(sessionId);
    if (!session) throw new Error('Browser session not found.');
    const secrets = await researchBrowserManager.captureSessionSecrets(session);
    const updated = await upsertBrowserSession({
      workspaceId: session.workspaceId,
      portal: session.portal,
      browserProfile: session.browserProfile,
      encryptedCookies: secrets.encryptedCookies,
      encryptedStorage: secrets.encryptedStorage,
      sessionStatus: 'valid',
      lastVerified: new Date().toISOString(),
    });
    return updated;
  }

  async expire(sessionId: string): Promise<void> {
    await markBrowserSessionExpired(sessionId);
  }

  async validateSession(sessionId: string): Promise<{
    ok: boolean;
    status: ResearchBrowserSessionStatus;
    message?: string;
  }> {
    const session = await getBrowserSessionById(sessionId);
    if (!session) return { ok: false, status: 'error', message: 'Session not found.' };

    if (session.expiresAt && new Date(session.expiresAt).getTime() < Date.now()) {
      await markBrowserSessionExpired(sessionId);
      return { ok: false, status: 'expired', message: 'Session expired.' };
    }

    const meta = getPortalMeta(session.portal);
    if (!meta) {
      return { ok: false, status: 'error', message: 'Unknown portal.' };
    }

    if (!session.encryptedCookies) {
      await touchBrowserSession(sessionId, { sessionStatus: 'needs_login' });
      return { ok: false, status: 'needs_login', message: 'Login required.' };
    }

    const outcome = await researchBrowserManager.withPage(
      session,
      `validate-${session.portal}`,
      async (page) => {
        await this.pages.goto(page, meta.loginUrl);
        const url = page.url().toLowerCase();
        const body = (await page.content()).toLowerCase();
        const loginSignals = ['login', 'sign in', 'otp', 'password', 'verify'];
        const looksLoggedOut = loginSignals.some(
          (s) => (url.includes(s) && !url.includes('profile')) || body.includes('enter otp'),
        );
        return !looksLoggedOut;
      },
    );

    if (outcome.error) {
      await touchBrowserSession(sessionId, { sessionStatus: 'error' });
      return {
        ok: false,
        status: 'error',
        message: outcome.error.message,
      };
    }

    if (!outcome.result) {
      await touchBrowserSession(sessionId, { sessionStatus: 'needs_login' });
      return { ok: false, status: 'needs_login', message: 'Login expired.' };
    }

    await touchBrowserSession(sessionId, {
      sessionStatus: 'valid',
      lastVerified: new Date().toISOString(),
    });
    return { ok: true, status: 'valid' };
  }

  async refreshFromLiveBrowser(sessionId: string): Promise<ResearchBrowserSession> {
    return this.renew(sessionId);
  }

  async saveAuthenticatedState(input: {
    workspaceId: string;
    portal: string;
  }): Promise<ResearchBrowserSession> {
    const session = await this.getOrCreate(input.workspaceId, input.portal);
    return this.renew(session.id);
  }
}

export const browserSessionManager = new BrowserSessionManager();
