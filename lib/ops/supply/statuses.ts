import type { SupplyActivityType } from '@/lib/ops/supply/types';

export const SUPPLY_SOURCES = [
  'cold_calling',
  'existing_owners',
  'broker_network',
  'referrals',
  'manual_inventory',
  'internal',
  'exclusive',
  'broker_shared',
] as const;

export type SupplySource = (typeof SUPPLY_SOURCES)[number];

export const SUPPLY_STATUSES = [
  'NEW',
  'VERIFIED',
  'OWNER_CONTACTED',
  'AVAILABLE',
  'RESERVED',
  'MATCHED',
  'DEAL_IN_PROGRESS',
  'CLOSED',
  'WITHDRAWN',
  'EXPIRED',
] as const;

export type SupplyStatus = (typeof SUPPLY_STATUSES)[number];

export const SUPPLY_PRIORITIES = ['HIGH', 'MEDIUM', 'LOW'] as const;

export type SupplyPriority = (typeof SUPPLY_PRIORITIES)[number];

export const SUPPLY_SOURCE_LABELS: Record<SupplySource, string> = {
  cold_calling: 'Cold Calling',
  existing_owners: 'Existing Owners',
  broker_network: 'Broker Network',
  referrals: 'Referrals',
  manual_inventory: 'Manual Inventory',
  internal: 'Internal Inventory',
  exclusive: 'Exclusive Listing',
  broker_shared: 'Broker Shared',
};

export const SUPPLY_STATUS_LABELS: Record<SupplyStatus, string> = {
  NEW: 'New',
  VERIFIED: 'Verified',
  OWNER_CONTACTED: 'Owner Contacted',
  AVAILABLE: 'Available',
  RESERVED: 'Reserved',
  MATCHED: 'Matched',
  DEAL_IN_PROGRESS: 'Deal In Progress',
  CLOSED: 'Closed',
  WITHDRAWN: 'Withdrawn',
  EXPIRED: 'Expired',
};

export const SUPPLY_PRIORITY_LABELS: Record<SupplyPriority, string> = {
  HIGH: 'High',
  MEDIUM: 'Medium',
  LOW: 'Low',
};

export const SUPPLY_ACTIVITY_LABELS: Record<SupplyActivityType, string> = {
  CREATED: 'Created',
  VERIFIED: 'Verified',
  OWNER_CALLED: 'Owner called',
  RENT_UPDATED: 'Rent updated',
  PRICE_CHANGED: 'Price changed',
  AGREEMENT_UPDATED: 'Agreement updated',
  STATUS_CHANGED: 'Status changed',
  ASSIGNED: 'Assigned',
  NOTE_ADDED: 'Note added',
  AVAILABILITY_CHANGED: 'Availability changed',
  FOLLOW_UP_SCHEDULED: 'Follow-up scheduled',
  FOLLOW_UP_COMPLETED: 'Follow-up completed',
  READY_FOR_MATCHING: 'Ready for matching',
};

export function isSupplyStatus(value: string): value is SupplyStatus {
  return SUPPLY_STATUSES.includes(value as SupplyStatus);
}

export function isSupplyPriority(value: string): value is SupplyPriority {
  return SUPPLY_PRIORITIES.includes(value as SupplyPriority);
}

export function isSupplySource(value: string): value is SupplySource {
  return SUPPLY_SOURCES.includes(value as SupplySource);
}

export function isAvailableStatus(status: SupplyStatus): boolean {
  return status === 'AVAILABLE' || status === 'VERIFIED' || status === 'OWNER_CONTACTED';
}
