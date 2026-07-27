import type { Page } from 'playwright';
import type {
  ConnectorSearchRequest,
  ConnectorSearchResponse,
  ResearchListing,
  ResearchPortalConnection,
} from '@/lib/research/types';
import type { LoginConfidenceResult } from '@/connectors/common/login-confidence';

/**
 * Real portal connector contract used by the research execution engine.
 * Shared browser/session lifecycle lives on BasePortalConnector;
 * portals implement login URL, auth extras, search URL, and listing parse.
 */
export interface PortalConnector {
  readonly key: string;
  readonly displayName: string;
  getLoginUrl?(): string;
  getVerifyUrl?(): string;
  /**
   * Optional Connect post-navigation step (e.g. open homepage login modal).
   * Called by Browser Worker after goto(loginUrl), before liveView is published.
   */
  ensureConnectLoginSurface?(page: Page): Promise<void>;
  isLoggedIn?(page: Page): Promise<LoginConfidenceResult>;
  connect(workspaceId: string): Promise<ResearchPortalConnection>;
  validateSession(workspaceId: string): Promise<{
    ok: boolean;
    status: string;
    message?: string;
    sessionId?: string;
    loginConfidence?: number;
  }>;
  executeSearch(request: ConnectorSearchRequest): Promise<ConnectorSearchResponse>;
  collectListings(request: ConnectorSearchRequest): Promise<ResearchListing[]>;
  extract(input: {
    html?: string;
    text?: string;
    url?: string;
  }): Promise<Record<string, unknown>>;
  disconnect(workspaceId: string): Promise<void>;
  /** Phase 1 compatibility — workspaceId preferred. */
  healthCheck?(workspaceIdOrConnectionId: string): Promise<{ ok: boolean; message?: string }>;
}
