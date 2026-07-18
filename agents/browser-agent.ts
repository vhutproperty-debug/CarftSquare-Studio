import type { ResearchBrowserSession } from '@/lib/research/types';

/**
 * Controls browser sessions for portal research tasks.
 * Phase 1: interface contract only — no automation implementation.
 */
export interface BrowserAgent {
  readonly name: 'BrowserAgent';
  openSession(workspaceId: string, portalKey: string): Promise<ResearchBrowserSession>;
  closeSession(sessionId: string): Promise<void>;
}
