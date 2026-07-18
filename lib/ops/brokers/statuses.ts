export const BROKER_IMPORT_STATUSES = [
  'PENDING',
  'PROCESSING',
  'COMPLETED',
  /** V2 preferred terminal for recoverable incomplete runs. */
  'PARTIAL',
  /**
   * V1 synonym retained for backward compatibility.
   * Treated as PARTIAL in V2 quality dashboards.
   */
  'COMPLETED_WITH_ERRORS',
  'FAILED',
  'DUPLICATE_FILE',
] as const;

export type BrokerImportStatus = (typeof BROKER_IMPORT_STATUSES)[number];

export const BROKER_MESSAGE_PARSE_STATUSES = [
  'PARSED',
  'SYSTEM',
  'MALFORMED',
  'SKIPPED',
] as const;

export type BrokerMessageParseStatus = (typeof BROKER_MESSAGE_PARSE_STATUSES)[number];

export const BROKER_TRANSACTION_TYPES = ['RENT', 'SALE', 'UNKNOWN'] as const;
export type BrokerTransactionType = (typeof BROKER_TRANSACTION_TYPES)[number];

export const BROKER_FRESHNESS_STATUSES = ['FRESH', 'AGING', 'STALE'] as const;
export type BrokerFreshnessStatus = (typeof BROKER_FRESHNESS_STATUSES)[number];

export const BROKER_INVENTORY_STATUSES = ['ACTIVE', 'INACTIVE', 'ARCHIVED'] as const;
export type BrokerInventoryStatus = (typeof BROKER_INVENTORY_STATUSES)[number];

export const BROKER_FURNISHING = [
  'FURNISHED',
  'SEMI_FURNISHED',
  'UNFURNISHED',
  'UNKNOWN',
] as const;
export type BrokerFurnishing = (typeof BROKER_FURNISHING)[number];

/** Formal inventory source model (V2) — prepare for unified supply later. */
export const BROKER_SOURCE_TYPES = [
  'BROKER_GROUP',
  'OWN_INVENTORY',
  'HOUSING',
  '99ACRES',
  'MAGICBRICKS',
  'MANUAL',
] as const;
export type BrokerSourceType = (typeof BROKER_SOURCE_TYPES)[number];

/** @deprecated Use BROKER_SOURCE_TYPES / BrokerSourceType. Kept for V1 imports. */
export const BROKER_SOURCE_TYPE = 'BROKER_GROUP' as const;

export const BROKER_REVIEW_REASONS = [
  'duplicate_uncertainty',
  'unknown_project',
  'conflicting_rent',
  'conflicting_configuration',
  'malformed_listing',
  'low_confidence',
] as const;
export type BrokerReviewReason = (typeof BROKER_REVIEW_REASONS)[number];

export const BROKER_REVIEW_STATUSES = [
  'PENDING',
  'APPROVED_MERGE',
  'CREATED_NEW',
  'IGNORED',
] as const;
export type BrokerReviewStatus = (typeof BROKER_REVIEW_STATUSES)[number];

export const BROKER_HISTORY_FIELDS = [
  'rent',
  'salePrice',
  'furnishing',
  'availability',
  'floor',
  'status',
  'configuration',
  'deposit',
  'parking',
  'projectName',
] as const;
export type BrokerHistoryField = (typeof BROKER_HISTORY_FIELDS)[number];

export const BROKER_IMPORT_STATUS_LABELS: Record<BrokerImportStatus, string> = {
  PENDING: 'Pending',
  PROCESSING: 'Processing',
  COMPLETED: 'Completed',
  PARTIAL: 'Partial',
  COMPLETED_WITH_ERRORS: 'Partial (legacy)',
  FAILED: 'Failed',
  DUPLICATE_FILE: 'Duplicate file',
};

export const BROKER_FRESHNESS_LABELS: Record<BrokerFreshnessStatus, string> = {
  FRESH: 'Fresh',
  AGING: 'Aging',
  STALE: 'Stale',
};

export const BROKER_TRANSACTION_LABELS: Record<BrokerTransactionType, string> = {
  RENT: 'Rent',
  SALE: 'Sale',
  UNKNOWN: 'Unknown',
};

export const BROKER_REVIEW_REASON_LABELS: Record<BrokerReviewReason, string> = {
  duplicate_uncertainty: 'Duplicate uncertainty',
  unknown_project: 'Unknown project',
  conflicting_rent: 'Conflicting rent',
  conflicting_configuration: 'Conflicting configuration',
  malformed_listing: 'Malformed listing',
  low_confidence: 'Low confidence',
};

export const BROKER_REVIEW_STATUS_LABELS: Record<BrokerReviewStatus, string> = {
  PENDING: 'Pending review',
  APPROVED_MERGE: 'Approved merge',
  CREATED_NEW: 'Created new',
  IGNORED: 'Ignored',
};

export function isBrokerFreshnessStatus(value: string): value is BrokerFreshnessStatus {
  return (BROKER_FRESHNESS_STATUSES as readonly string[]).includes(value);
}

export function isBrokerTransactionType(value: string): value is BrokerTransactionType {
  return (BROKER_TRANSACTION_TYPES as readonly string[]).includes(value);
}

export function isBrokerInventoryStatus(value: string): value is BrokerInventoryStatus {
  return (BROKER_INVENTORY_STATUSES as readonly string[]).includes(value);
}

export function isTerminalImportStatus(status: BrokerImportStatus): boolean {
  return status === 'COMPLETED' || status === 'PARTIAL' || status === 'COMPLETED_WITH_ERRORS'
    || status === 'FAILED' || status === 'DUPLICATE_FILE';
}

export function isResumableImportStatus(status: BrokerImportStatus): boolean {
  return status === 'FAILED' || status === 'PARTIAL' || status === 'COMPLETED_WITH_ERRORS'
    || status === 'PROCESSING';
}

/** Normalize V1 COMPLETED_WITH_ERRORS → PARTIAL for dashboards. */
export function normalizeImportStatusForUi(status: BrokerImportStatus): BrokerImportStatus {
  if (status === 'COMPLETED_WITH_ERRORS') return 'PARTIAL';
  return status;
}
