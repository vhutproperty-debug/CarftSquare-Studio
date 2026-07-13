import type { MatchActivityType } from '@/lib/ops/matching/types';

export const MATCH_STATUSES = [
  'SUGGESTED',
  'SHORTLISTED',
  'OWNER_CONTACTED',
  'CLIENT_SHARED',
  'SITE_VISIT_SCHEDULED',
  'ACCEPTED',
  'REJECTED',
  'CONVERTED_TO_DEAL',
] as const;

export type MatchStatus = (typeof MATCH_STATUSES)[number];

export const MATCH_STATUS_LABELS: Record<MatchStatus, string> = {
  SUGGESTED: 'Suggested',
  SHORTLISTED: 'Shortlisted',
  OWNER_CONTACTED: 'Owner Contacted',
  CLIENT_SHARED: 'Client Shared',
  SITE_VISIT_SCHEDULED: 'Site Visit Scheduled',
  ACCEPTED: 'Accepted',
  REJECTED: 'Rejected',
  CONVERTED_TO_DEAL: 'Converted to Deal',
};

export const MATCH_ACTIVITY_LABELS: Record<MatchActivityType, string> = {
  CREATED: 'Created',
  GENERATED: 'Generated',
  SCORE_UPDATED: 'Score updated',
  SHORTLISTED: 'Shortlisted',
  REJECTED: 'Rejected',
  OWNER_CONTACTED: 'Owner contacted',
  CLIENT_SHARED: 'Shared with client',
  SITE_VISIT_SCHEDULED: 'Site visit scheduled',
  ACCEPTED: 'Accepted',
  CONVERTED_TO_DEAL: 'Converted to deal',
  ASSIGNED: 'Assigned',
  NOTE_ADDED: 'Note added',
  STATUS_CHANGED: 'Status changed',
};

export function isMatchStatus(value: string): value is MatchStatus {
  return MATCH_STATUSES.includes(value as MatchStatus);
}

export function isTerminalMatchStatus(status: MatchStatus): boolean {
  return status === 'REJECTED' || status === 'CONVERTED_TO_DEAL' || status === 'ACCEPTED';
}

export function scoreTone(score: number): 'high' | 'medium' | 'low' {
  if (score >= 80) return 'high';
  if (score >= 55) return 'medium';
  return 'low';
}
