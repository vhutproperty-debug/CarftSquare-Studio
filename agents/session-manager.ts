import type { ResearchBrowserSession, ResearchBrowserSessionStatus } from '@/lib/research/types';

/**
 * Lifecycle management for research browser sessions.
 * Phase 2: implemented by BrowserSessionManager.
 */
export interface SessionManager {
  readonly name: 'SessionManager';
  get(sessionId: string): Promise<ResearchBrowserSession | null>;
  renew(sessionId: string): Promise<ResearchBrowserSession>;
  expire(sessionId: string): Promise<void>;
  list?(workspaceId: string): Promise<ResearchBrowserSession[]>;
  getOrCreate?(workspaceId: string, portal: string): Promise<ResearchBrowserSession>;
  validateSession?(sessionId: string): Promise<{
    ok: boolean;
    status: ResearchBrowserSessionStatus;
    message?: string;
  }>;
}
