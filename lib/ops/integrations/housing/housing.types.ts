import type { ConnectorSyncError } from '@/lib/ops/integrations/connector.types';

export const HOUSING_CONNECTOR_ID = 'housing' as const;
export const HOUSING_SOURCE = 'housing' as const;
export const HOUSING_RAW_COLLECTION = 'ops_housing_raw' as const;
export const HOUSING_SYNC_LOG_COLLECTION = 'ops_housing_sync_logs' as const;

/** Housing.com max inclusive window per request (seconds). */
export const HOUSING_MAX_WINDOW_SECONDS = 2 * 24 * 60 * 60;

export type HousingSyncState = 'raw' | 'normalized' | 'imported' | 'failed';

/** Normalized demand fields mapped from Housing API — unknown fields stay in payload only. */
export type HousingNormalizedDemand = {
  externalLeadId: string;
  source: typeof HOUSING_SOURCE;
  customerName?: string | null;
  mobile?: string | null;
  email?: string | null;
  propertyType?: string | null;
  project?: string | null;
  locality?: string | null;
  city?: string | null;
  budget?: string | null;
  area?: string | null;
  configuration?: string | null;
  buyRent?: string | null;
  message?: string | null;
  leadDate?: string | null;
  assignedTo?: string | null;
  status?: string | null;
  rawReferenceId: string;
};

export type OpsHousingRawRecord = {
  id: string;
  externalLeadId: string;
  payload: Record<string, unknown>;
  normalized: HousingNormalizedDemand;
  syncState: HousingSyncState;
  fetchedAt: string;
  updatedAt: string;
  importedAt?: string | null;
  lastError?: string | null;
};

export type HousingSyncLogKind = 'sync' | 'test';

export type HousingSyncLogRecord = {
  id: string;
  kind: HousingSyncLogKind;
  startedAt: string;
  completedAt?: string | null;
  status: 'running' | 'completed' | 'failed';
  leadsFetched: number;
  imported: number;
  updated: number;
  duplicates: number;
  failed: number;
  durationMs?: number | null;
  errors: ConnectorSyncError[];
  triggeredBy: string;
  authOk?: boolean | null;
  apiResponseStatus?: number | null;
  lastErrorMessage?: string | null;
  /** Optional chunk telemetry (no schema migration required). */
  chunksAttempted?: number | null;
  chunksCompleted?: number | null;
  zeroResult?: boolean | null;
};

/**
 * Confirmed Housing.com get-builder-leads lead shape.
 * Legacy aliases retained for defensive compatibility.
 */
export type HousingApiLead = {
  lead_date?: number | string;
  apartment_names?: string;
  country_code?: string | number;
  service_type?: string;
  category_type?: string;
  locality_name?: string;
  city_name?: string;
  lead_name?: string;
  lead_email?: string;
  lead_phone?: string | number;
  flat_id?: string | number;
  project_name?: string;
  property_field?: string | string[];
  max_area?: number | string;
  min_area?: number | string;
  min_price?: number | string;
  max_price?: number | string;
  /** Legacy / alternate field names */
  lead_id?: string | number;
  id?: string | number;
  leadId?: string | number;
  name?: string;
  customer_name?: string;
  customerName?: string;
  mobile?: string | number;
  phone?: string | number;
  contact_number?: string | number;
  email?: string;
  property_type?: string;
  propertyType?: string;
  project?: string;
  locality?: string;
  location?: string;
  budget?: string | number;
  configuration?: string;
  bhk?: string;
  buy_rent?: string;
  requirement_type?: string;
  message?: string;
  remarks?: string;
  created_at?: string;
  createdAt?: string;
  assigned_to?: string;
  assignedTo?: string;
  status?: string;
  [key: string]: unknown;
};

export type HousingApiResponse = {
  leads?: HousingApiLead[];
  data?: HousingApiLead[];
  results?: HousingApiLead[];
  message?: string;
};

export type HousingChunkResult = {
  startUnix: number;
  endUnix: number;
  httpStatus: number;
  ok: boolean;
  leadsFetched: number;
  errorMessage?: string;
};

export type HousingDedupeMatch = {
  action: 'create' | 'update';
  existingRawId: string;
  existingSourceId: string;
  reason: 'externalLeadId' | 'mobile' | 'email' | 'mobile_project';
};

export type HousingSyncCounters = {
  leadsFetched: number;
  imported: number;
  updated: number;
  duplicates: number;
  failed: number;
  errors: ConnectorSyncError[];
  chunksAttempted: number;
  chunksCompleted: number;
};

export type HousingConnectorStatusSnapshot = {
  connectorId: string;
  label: string;
  connectionStatus: 'connected' | 'not_connected' | 'misconfigured';
  configured: boolean;
  authenticated: boolean;
  lastSyncAt: string | null;
  lastSuccessfulSyncAt: string | null;
  lastSyncDurationMs: number | null;
  totalLeads: number;
  leadsImportedLastSync: number | null;
  importedToday: number;
  updatedToday: number;
  failedRecords: number;
  duplicateRecords: number;
  apiResponseStatus: number | null;
  lastErrorMessage: string | null;
  message?: string;
};

export type HousingSyncOutcome = {
  success: boolean;
  authOk: boolean;
  apiResponseStatus: number | null;
  error?: string;
  logId: string;
  durationMs: number;
  leadsFetched: number;
  imported: number;
  updated: number;
  duplicates: number;
  failed: number;
  errors: ConnectorSyncError[];
  chunksAttempted: number;
  chunksCompleted: number;
  zeroResult: boolean;
  partial: boolean;
};

export type HousingTestConnectionResult = {
  success: boolean;
  authOk: boolean;
  apiResponseStatus: number | null;
  error?: string;
  logId: string;
  durationMs: number;
  leadsAvailable?: number;
};
