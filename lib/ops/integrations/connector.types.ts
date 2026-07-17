/** Shared connector framework types for demand source integrations. */

export type ConnectorSyncError = {
  externalLeadId?: string;
  message: string;
};

export type ConnectorSyncStats = {
  leadsFetched: number;
  imported: number;
  updated: number;
  duplicates: number;
  failed: number;
  errors: ConnectorSyncError[];
};

export type ConnectorSyncResult = ConnectorSyncStats & {
  logId: string;
  durationMs: number;
};

export type ConnectorConnectionStatus = 'connected' | 'misconfigured' | 'error';

export type ConnectorStatusSnapshot = {
  connectorId: string;
  label: string;
  connectionStatus: ConnectorConnectionStatus;
  configured: boolean;
  lastSyncAt: string | null;
  lastSyncDurationMs: number | null;
  totalLeads: number;
  importedToday: number;
  updatedToday: number;
  failedRecords: number;
  duplicateRecords: number;
  message?: string;
};

/** Contract future connectors (99acres, MagicBricks, etc.) should implement. */
export interface DemandConnector {
  readonly id: string;
  readonly label: string;
  sync(triggeredBy: string): Promise<ConnectorSyncResult>;
  getStatus(): Promise<ConnectorStatusSnapshot>;
}
