import type { PortalConnector } from '@/connectors/common/portal-connector';

/**
 * Phase 1 Connector contract — Phase 2 uses PortalConnector.
 * Kept as an alias so existing imports remain stable.
 */
export type Connector = PortalConnector;

export type { PortalConnector } from '@/connectors/common/portal-connector';
