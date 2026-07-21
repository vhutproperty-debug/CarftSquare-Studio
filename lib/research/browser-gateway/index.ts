export type * from '@/lib/research/browser-gateway/types';
export { resolveBrowserProvider, getBrowserProviderAdapter } from '@/lib/research/browser-gateway/adapters';
export {
  createConnectSession,
  getConnectSessionById,
  listConnectSessions,
  updateConnectSession,
  claimNextConnectSession,
  publicConnectSession,
  expireStaleConnectSessions,
} from '@/lib/research/browser-gateway/connect-session-store';
export {
  startRemoteConnect,
  getConnectSessionPublic,
  listConnectorStatuses,
  liveValidateConnectorStatuses,
  disconnectPortal,
  reconnectPortal,
  requestSessionRefresh,
  notifySessionNeedsLogin,
} from '@/lib/research/browser-gateway/gateway';
export {
  deriveConnectorDisplay,
  humanizeConnectorError,
  formatSessionAge,
  buildConnectorDiagnostics,
} from '@/lib/research/browser-gateway/connector-status';
export type { ConnectorDisplayState } from '@/lib/research/browser-gateway/connector-status';
export {
  processNextConnectJob,
  validateDueSessions,
  cleanupExpiredProfiles,
} from '@/lib/research/browser-gateway/worker-runtime';
export {
  fetchBrowserWorkerStatus,
  fetchBrowserWorkerLogs,
  getBrowserWorkerBaseUrl,
} from '@/lib/research/browser-gateway/worker-client';
