export type { Connector, PortalConnector } from '@/connectors/connector';
export type { ExtractionEngine } from '@/connectors/extraction-engine';
export type { PortalConnector as ResearchPortalConnector } from '@/connectors/common/portal-connector';
export {
  listPortalConnectors,
  getPortalConnector,
  requirePortalConnector,
} from '@/connectors/registry';
export { BasePortalConnector } from '@/connectors/common/base-connector';
export { connectorRuntime } from '@/connectors/common/connector-runtime';
export {
  startConnectorHealthMonitor,
  stopConnectorHealthMonitor,
} from '@/connectors/common/connector-health-monitor';
export { LOGIN_CONFIDENCE_THRESHOLD } from '@/connectors/common/connector-lifecycle';
export type { ConnectorLifecycleState } from '@/connectors/common/connector-lifecycle';
export type { ConnectorRuntimeSnapshot } from '@/connectors/common/connector-runtime';
export {
  scoreLoginConfidence,
  evaluatePageLoginConfidence,
} from '@/connectors/common/login-confidence';
export {
  AUTH_CONFIDENCE_THRESHOLD,
  scoreAuthEvidence,
  evaluatePageAuth,
  verifyAuthOnPage,
} from '@/lib/research/auth-detection/auth-evidence-engine';
