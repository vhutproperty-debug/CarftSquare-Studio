import type { DemandPriority, DemandStatus } from '@/lib/ops/demand/statuses';
import type { NormalizedOpsLead, OpsLeadSource } from '@/lib/ops/leads/types';

export type DemandRentBuy = 'rent' | 'buy' | 'unknown';

export type DemandQualification = {
  rentBuy?: DemandRentBuy;
  budget?: string;
  bhk?: string;
  furnishing?: string;
  preferredBuildings?: string;
  possessionTimeline?: string;
  familyOrBachelor?: string;
  company?: string;
  parkingRequirement?: string;
  pets?: string;
  notes?: string;
};

export type OpsDemandRecord = {
  id: string;
  source: OpsLeadSource;
  sourceId: string;
  normalizedPhone?: string;
  normalizedEmail?: string;
  status: DemandStatus;
  priority: DemandPriority;
  assignedTo?: string;
  assignedToName?: string;
  qualification: DemandQualification;
  qualificationPercent: number;
  internalNotes?: string;
  nextFollowUpAt?: string;
  followUpCompletedAt?: string;
  firstContactedAt?: string;
  readyForMatchingAt?: string;
  lostReason?: string;
  createdAt: string;
  updatedAt: string;
  updatedBy?: string;
};

export type DemandActivityType =
  | 'LEAD_CREATED'
  | 'ASSIGNED'
  | 'CALL_LOGGED'
  | 'NOTE_ADDED'
  | 'STATUS_CHANGED'
  | 'FOLLOW_UP_SCHEDULED'
  | 'FOLLOW_UP_COMPLETED'
  | 'QUALIFICATION_UPDATED';

export type OpsDemandActivity = {
  id: string;
  source: OpsLeadSource;
  sourceId: string;
  type: DemandActivityType;
  message: string;
  meta?: Record<string, unknown>;
  actorId: string;
  actorEmail?: string;
  actorName?: string;
  createdAt: string;
};

export type DemandDuplicateHint = {
  source: OpsLeadSource;
  sourceId: string;
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  matchType: 'phone' | 'email';
};

export type DemandQueueItem = {
  key: string;
  lead: NormalizedOpsLead;
  demand: OpsDemandRecord;
  lastActivityAt?: string | null;
  lastActivityLabel?: string | null;
  ageHours: number;
  duplicateHints: DemandDuplicateHint[];
  assigneeInitials?: string;
};

export type DemandWorkspaceMetrics = {
  totalEnquiries: number;
  newToday: number;
  qualified: number;
  waitingFollowUp: number;
  readyForMatching: number;
  lost: number;
  averageResponseMinutes: number | null;
  overdueHighPriority: number;
};

export type DemandSourceBreakdownItem = {
  channelId: string;
  label: string;
  count: number;
  live: boolean;
};

export type DemandWorkspaceResult = {
  items: DemandQueueItem[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
  sourceHealth: Partial<Record<OpsLeadSource, 'ok' | 'error'>>;
  metrics: DemandWorkspaceMetrics;
  sourceBreakdown: DemandSourceBreakdownItem[];
  /** Present so the Demand UI can avoid extra /api/ops/team + /api/auth/status round trips. */
  team?: Array<{ id: string; name: string; email: string }>;
  currentUserId?: string;
};

export function demandKey(source: OpsLeadSource, sourceId: string): string {
  return `${source}:${sourceId}`;
}

export function parseDemandKey(key: string): { source: OpsLeadSource; sourceId: string } | null {
  const idx = key.indexOf(':');
  if (idx <= 0) return null;
  return { source: key.slice(0, idx) as OpsLeadSource, sourceId: key.slice(idx + 1) };
}
