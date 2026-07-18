import type { PortalConnector } from '@/connectors/common/portal-connector';
import { housingConnector } from '@/connectors/housing';
import { magicbricksConnector } from '@/connectors/magicbricks';
import { ninetyNineAcresConnector } from '@/connectors/99acres';
import { nobrokerConnector } from '@/connectors/nobroker';
import { squareyardsConnector } from '@/connectors/squareyards';

const CONNECTORS: PortalConnector[] = [
  housingConnector,
  magicbricksConnector,
  ninetyNineAcresConnector,
  nobrokerConnector,
  squareyardsConnector,
];

export function listPortalConnectors(): PortalConnector[] {
  return CONNECTORS;
}

export function getPortalConnector(key: string): PortalConnector | null {
  return CONNECTORS.find((c) => c.key === key) || null;
}

export function requirePortalConnector(key: string): PortalConnector {
  const connector = getPortalConnector(key);
  if (!connector) throw new Error(`Unknown portal connector: ${key}`);
  return connector;
}
