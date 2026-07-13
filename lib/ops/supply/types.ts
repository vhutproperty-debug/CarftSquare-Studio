import type { SupplyPriority, SupplySource, SupplyStatus } from '@/lib/ops/supply/statuses';

export type SupplyListingType = 'rent' | 'sale';

export type OpsSupplyRecord = {
  id: string;
  propertyType?: string;
  listingType?: SupplyListingType;
  project?: string;
  building?: string;
  wing?: string;
  flatNumber?: string;
  configuration?: string;
  carpetArea?: string;
  floor?: string;
  facing?: string;
  parking?: string;
  ownerName?: string;
  ownerMobile?: string;
  ownerEmail?: string;
  normalizedOwnerMobile?: string;
  normalizedOwnerEmail?: string;
  source: SupplySource;
  exclusive?: boolean;
  availableFrom?: string;
  expectedRent?: string;
  expectedDeposit?: string;
  expectedSalePrice?: string;
  brokeragePercent?: string;
  furnishedStatus?: string;
  keysAvailable?: boolean;
  tenantOccupied?: boolean;
  agreementExpiry?: string;
  possessionStatus?: string;
  lastContactAt?: string;
  assignedBroker?: string;
  assignedBrokerName?: string;
  priority: SupplyPriority;
  status: SupplyStatus;
  availabilityStatus?: string;
  readyForMatching: boolean;
  readyForMatchingAt?: string;
  internalNotes?: string;
  nextFollowUpAt?: string;
  followUpCompletedAt?: string;
  prospectId?: string;
  createdAt: string;
  updatedAt: string;
  updatedBy?: string;
};

export type SupplyActivityType =
  | 'CREATED'
  | 'VERIFIED'
  | 'OWNER_CALLED'
  | 'RENT_UPDATED'
  | 'PRICE_CHANGED'
  | 'AGREEMENT_UPDATED'
  | 'STATUS_CHANGED'
  | 'ASSIGNED'
  | 'NOTE_ADDED'
  | 'AVAILABILITY_CHANGED'
  | 'FOLLOW_UP_SCHEDULED'
  | 'FOLLOW_UP_COMPLETED'
  | 'READY_FOR_MATCHING';

export type OpsSupplyActivity = {
  id: string;
  supplyId: string;
  type: SupplyActivityType;
  message: string;
  meta?: Record<string, unknown>;
  actorId: string;
  actorEmail?: string;
  actorName?: string;
  createdAt: string;
};

export type SupplyQueueItem = {
  id: string;
  record: OpsSupplyRecord;
  lastActivityAt?: string | null;
  lastActivityLabel?: string | null;
  assigneeInitials?: string;
  agreementExpiringSoon?: boolean;
};

export type SupplyWorkspaceMetrics = {
  totalInventory: number;
  rentalInventory: number;
  saleInventory: number;
  availableNow: number;
  readyForMatching: number;
  agreementExpiring: number;
  exclusiveListings: number;
  withdrawn: number;
};

export type SupplyWorkspaceResult = {
  items: SupplyQueueItem[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
  metrics: SupplyWorkspaceMetrics;
};

export function supplyDisplayLabel(record: OpsSupplyRecord): string {
  const parts = [record.building, record.configuration, record.flatNumber].filter(Boolean);
  return parts.length ? parts.join(' · ') : record.project || 'Untitled listing';
}

export function assigneeInitials(name?: string | null): string | undefined {
  if (!name?.trim()) return undefined;
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('');
}
