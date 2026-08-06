/**
 * Public barrel for the provider-agnostic Connector API.
 * Prefer importing from here in app routes and external modules.
 */
export {
  ConnectorApiError,
  listConnectorProviders,
  getConnectorStatuses,
  getConnectorHealth,
  createConnectorSession,
  getConnectorSession,
  listConnectorSessions,
  cancelConnectorSession,
  submitConnectorSessionOtp,
  disconnectConnectorProvider,
  reconnectConnectorProvider,
  refreshConnectorProvider,
  validateConnectorProvider,
  executeConnectorSearch,
  executeConnectorSearchMany,
  type ConnectorProviderInfo,
  type ConnectorProviderStatus,
  type ConnectorHealthReport,
  type ConnectorSearchResult,
} from '@/lib/research/connector-api/service';

export {
  resolveWorkspaceId,
  workspaceIdFromQuery,
  connectorApiErrorResponse,
} from '@/lib/research/connector-api/http';

export {
  extractPropAiApiKey,
  isValidPropAiApiKey,
  requireConnectorConsumerAccess,
  connectorConsumerAuthToResponse,
  type ConnectorConsumerAuthResult,
  type PropAiAuthSuccess,
} from '@/lib/research/connector-api/prop-ai-auth';
