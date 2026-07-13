import type { DemandActivityType } from '@/lib/ops/demand/types';

export const DEMAND_STATUSES = [
  'NEW',
  'CONTACTED',
  'QUALIFIED',
  'FOLLOW_UP',
  'SITE_VISIT',
  'READY_FOR_MATCHING',
  'LOST',
] as const;

export type DemandStatus = (typeof DEMAND_STATUSES)[number];

export const DEMAND_PRIORITIES = ['HIGH', 'MEDIUM', 'LOW'] as const;

export type DemandPriority = (typeof DEMAND_PRIORITIES)[number];

export const DEMAND_STATUS_LABELS: Record<DemandStatus, string> = {
  NEW: 'New',
  CONTACTED: 'Contacted',
  QUALIFIED: 'Qualified',
  FOLLOW_UP: 'Follow-up',
  SITE_VISIT: 'Site Visit',
  READY_FOR_MATCHING: 'Ready for Matching',
  LOST: 'Lost',
};

export const DEMAND_PRIORITY_LABELS: Record<DemandPriority, string> = {
  HIGH: 'High',
  MEDIUM: 'Medium',
  LOW: 'Low',
};

export const DEMAND_STATUS_FLOW: DemandStatus[] = [
  'NEW',
  'CONTACTED',
  'QUALIFIED',
  'FOLLOW_UP',
  'SITE_VISIT',
  'READY_FOR_MATCHING',
  'LOST',
];

export function isDemandStatus(value: string): value is DemandStatus {
  return DEMAND_STATUSES.includes(value as DemandStatus);
}

export function isDemandPriority(value: string): value is DemandPriority {
  return DEMAND_PRIORITIES.includes(value as DemandPriority);
}

export function statusRequiresFollowUp(status: DemandStatus): boolean {
  return status === 'FOLLOW_UP';
}

export const DEMAND_ACTIVITY_LABELS: Record<DemandActivityType, string> = {
  LEAD_CREATED: 'Lead created',
  ASSIGNED: 'Assigned',
  CALL_LOGGED: 'Call logged',
  NOTE_ADDED: 'Note added',
  STATUS_CHANGED: 'Status changed',
  FOLLOW_UP_SCHEDULED: 'Follow-up scheduled',
  FOLLOW_UP_COMPLETED: 'Follow-up completed',
  QUALIFICATION_UPDATED: 'Qualification updated',
};
