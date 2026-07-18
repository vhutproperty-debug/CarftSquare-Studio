import type { BrowserAgent } from '@/agents/browser-agent';
import { browserSessionManager } from '@/lib/research/sessions/browser-session-manager';
import type { ResearchBrowserSession } from '@/lib/research/types';

/** Phase 3 BrowserAgent — wraps Phase 2 session manager. */
export class ResearchBrowserAgent implements BrowserAgent {
  readonly name = 'BrowserAgent' as const;

  async openSession(workspaceId: string, portalKey: string): Promise<ResearchBrowserSession> {
    return browserSessionManager.getOrCreate(workspaceId, portalKey);
  }

  async closeSession(sessionId: string): Promise<void> {
    await browserSessionManager.expire(sessionId);
  }
}

export const researchBrowserAgent = new ResearchBrowserAgent();
