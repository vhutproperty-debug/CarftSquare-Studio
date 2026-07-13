import type { MatchStatus } from '@/lib/ops/matching/statuses';
import type { OpsLeadSource } from '@/lib/ops/leads/types';
import type { DemandQualification } from '@/lib/ops/demand/types';
import type { OpsSupplyRecord } from '@/lib/ops/supply/types';

export type MatchProfile = {
  transactionType?: 'rent' | 'buy';
  budget?: number | null;
  configuration?: string;
  project?: string;
  building?: string;
  furnishing?: string;
  parking?: string;
  timeline?: string;
  areaPreference?: string;
  notes?: string;
};

export type OpsMatchRecord = {
  id: string;
  demandKey: string;
  demandSource: OpsLeadSource;
  demandSourceId: string;
  supplyId: string;
  score: number;
  reasons: string[];
  broker?: string;
  brokerName?: string;
  status: MatchStatus;
  notes?: string;
  siteVisitAt?: string;
  createdAt: string;
  updatedAt: string;
  updatedBy?: string;
};

export type MatchActivityType =
  | 'CREATED'
  | 'GENERATED'
  | 'SCORE_UPDATED'
  | 'SHORTLISTED'
  | 'REJECTED'
  | 'OWNER_CONTACTED'
  | 'CLIENT_SHARED'
  | 'SITE_VISIT_SCHEDULED'
  | 'ACCEPTED'
  | 'CONVERTED_TO_DEAL'
  | 'ASSIGNED'
  | 'NOTE_ADDED'
  | 'STATUS_CHANGED';

export type OpsMatchActivity = {
  id: string;
  matchId: string;
  type: MatchActivityType;
  message: string;
  meta?: Record<string, unknown>;
  actorId: string;
  actorEmail?: string;
  actorName?: string;
  createdAt: string;
};

export type MatchDemandSummary = {
  key: string;
  source: OpsLeadSource;
  sourceId: string;
  name?: string | null;
  phone?: string | null;
  projectName?: string | null;
  location?: string | null;
  requirement?: string | null;
  budget?: string | null;
  qualification: DemandQualification;
  assignedToName?: string;
};

export type MatchSupplySummary = {
  id: string;
  label: string;
  project?: string;
  building?: string;
  configuration?: string;
  listingType?: string;
  expectedRent?: string;
  expectedSalePrice?: string;
  ownerName?: string;
  assignedBrokerName?: string;
  availabilityStatus?: string;
  furnishedStatus?: string;
};

export type MatchQueueItem = {
  id: string;
  match: OpsMatchRecord;
  demand: MatchDemandSummary;
  supply: MatchSupplySummary;
  lastActivityLabel?: string | null;
  assigneeInitials?: string;
};

export type MatchingWorkspaceMetrics = {
  eligibleDemand: number;
  eligibleSupply: number;
  suggestedMatches: number;
  shortlisted: number;
  siteVisits: number;
  accepted: number;
  rejected: number;
  converted: number;
};

export type MatchingWorkspaceResult = {
  items: MatchQueueItem[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
  metrics: MatchingWorkspaceMetrics;
};

export type MatchGenerationResult = {
  created: number;
  updated: number;
  skipped: number;
  totalPairsEvaluated: number;
};

export function matchDemandSupplyKey(demandKey: string, supplyId: string): string {
  return `${demandKey}::${supplyId}`;
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

export function buildSupplySummary(record: OpsSupplyRecord): MatchSupplySummary {
  return {
    id: record.id,
    label: [record.building, record.configuration, record.flatNumber].filter(Boolean).join(' · ') || record.project || 'Listing',
    project: record.project,
    building: record.building,
    configuration: record.configuration,
    listingType: record.listingType,
    expectedRent: record.expectedRent,
    expectedSalePrice: record.expectedSalePrice,
    ownerName: record.ownerName,
    assignedBrokerName: record.assignedBrokerName,
    availabilityStatus: record.availabilityStatus,
    furnishedStatus: record.furnishedStatus,
  };
}
