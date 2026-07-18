import type {
  ConnectorSearchRequest,
  ConnectorSearchResponse,
  ResearchListing,
  ResearchPortalConnection,
} from '@/lib/research/types';

/**
 * Real portal connector contract used by the research execution engine.
 */
export interface PortalConnector {
  readonly key: string;
  readonly displayName: string;
  connect(workspaceId: string): Promise<ResearchPortalConnection>;
  validateSession(workspaceId: string): Promise<{
    ok: boolean;
    status: string;
    message?: string;
    sessionId?: string;
  }>;
  executeSearch(request: ConnectorSearchRequest): Promise<ConnectorSearchResponse>;
  collectListings(request: ConnectorSearchRequest): Promise<ResearchListing[]>;
  extract(input: {
    html?: string;
    text?: string;
    url?: string;
  }): Promise<Record<string, unknown>>;
  disconnect(workspaceId: string): Promise<void>;
  /** Phase 1 compatibility */
  healthCheck?(connectionId: string): Promise<{ ok: boolean; message?: string }>;
}
