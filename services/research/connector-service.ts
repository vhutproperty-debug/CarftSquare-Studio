import { getPortalConnector, listPortalConnectors } from '@/connectors/registry';
import { RESEARCH_COLLECTIONS } from '@/lib/research/collections';
import {
  listPortalConnections,
  upsertPortalConnection,
} from '@/lib/research/store/portal-connections';
import { ensureResearchIndexes, getResearchDatabase } from '@/lib/research/store';
import type { ResearchPortalConnection } from '@/lib/research/types';

/**
 * Application service for portal connectors.
 */
export interface ResearchConnectorService {
  list(workspaceId: string): Promise<ResearchPortalConnection[]>;
  connect(workspaceId: string, portalKey: string): Promise<ResearchPortalConnection>;
  disconnect(connectionId: string): Promise<void>;
}

export class DefaultResearchConnectorService implements ResearchConnectorService {
  async list(workspaceId: string): Promise<ResearchPortalConnection[]> {
    const existing = await listPortalConnections(workspaceId);
    const byKey = new Map(existing.map((c) => [c.portalKey, c]));
    const merged: ResearchPortalConnection[] = [];
    for (const connector of listPortalConnectors()) {
      const row = byKey.get(connector.key);
      if (row) {
        merged.push(row);
      } else {
        merged.push({
          id: `virtual-${connector.key}`,
          workspaceId,
          portalKey: connector.key,
          portalName: connector.displayName,
          status: 'disconnected',
          createdAt: new Date(0).toISOString(),
          updatedAt: new Date(0).toISOString(),
        });
      }
    }
    return merged;
  }

  async connect(workspaceId: string, portalKey: string): Promise<ResearchPortalConnection> {
    const connector = getPortalConnector(portalKey);
    if (!connector) throw new Error(`Unknown portal: ${portalKey}`);
    return connector.connect(workspaceId);
  }

  async disconnect(connectionId: string): Promise<void> {
    const db = await getResearchDatabase();
    await ensureResearchIndexes(db);
    const doc = await db
      .collection<ResearchPortalConnection>(RESEARCH_COLLECTIONS.portalConnections)
      .findOne({ id: connectionId });
    if (!doc) throw new Error('Portal connection not found.');
    const connector = getPortalConnector(doc.portalKey);
    if (connector) {
      await connector.disconnect(doc.workspaceId);
      return;
    }
    await upsertPortalConnection({
      workspaceId: doc.workspaceId,
      portalKey: doc.portalKey,
      portalName: doc.portalName,
      status: 'disconnected',
    });
  }
}

export const researchConnectorService = new DefaultResearchConnectorService();
