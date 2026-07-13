import type { DealActivityType } from '@/lib/ops/deals/types';

export const DEAL_STAGES = [
  'NEW',
  'SITE_VISIT_SCHEDULED',
  'SITE_VISIT_COMPLETED',
  'NEGOTIATION',
  'TOKEN_PENDING',
  'TOKEN_RECEIVED',
  'DOCUMENTATION',
  'AGREEMENT_SCHEDULED',
  'AGREEMENT_COMPLETED',
  'COMMISSION_PENDING',
  'COMMISSION_RECEIVED',
  'CLOSED',
  'LOST',
] as const;

export type DealStage = (typeof DEAL_STAGES)[number];

export const DEAL_TRANSACTION_TYPES = ['rent', 'sale'] as const;

export type DealTransactionType = (typeof DEAL_TRANSACTION_TYPES)[number];

export const DEAL_PAYMENT_STATUSES = [
  'NOT_DUE',
  'PARTIAL',
  'PENDING',
  'COLLECTED',
] as const;

export type DealPaymentStatus = (typeof DEAL_PAYMENT_STATUSES)[number];

export const DEAL_STAGE_LABELS: Record<DealStage, string> = {
  NEW: 'New',
  SITE_VISIT_SCHEDULED: 'Site Visit Scheduled',
  SITE_VISIT_COMPLETED: 'Site Visit Completed',
  NEGOTIATION: 'Negotiation',
  TOKEN_PENDING: 'Token Pending',
  TOKEN_RECEIVED: 'Token Received',
  DOCUMENTATION: 'Documentation',
  AGREEMENT_SCHEDULED: 'Agreement Scheduled',
  AGREEMENT_COMPLETED: 'Agreement Completed',
  COMMISSION_PENDING: 'Commission Pending',
  COMMISSION_RECEIVED: 'Commission Received',
  CLOSED: 'Closed',
  LOST: 'Lost',
};

export const DEAL_PAYMENT_STATUS_LABELS: Record<DealPaymentStatus, string> = {
  NOT_DUE: 'Not due',
  PARTIAL: 'Partial',
  PENDING: 'Pending',
  COLLECTED: 'Collected',
};

export const DEAL_ACTIVITY_LABELS: Record<DealActivityType, string> = {
  DEAL_CREATED: 'Deal created',
  STAGE_CHANGED: 'Stage changed',
  OFFER_UPDATED: 'Offer updated',
  SITE_VISIT_SCHEDULED: 'Site visit scheduled',
  SITE_VISIT_COMPLETED: 'Site visit completed',
  TOKEN_RECEIVED: 'Token received',
  AGREEMENT_COMPLETED: 'Agreement completed',
  COMMISSION_RECEIVED: 'Commission received',
  DOCUMENT_UPDATED: 'Document updated',
  ASSIGNED: 'Assigned',
  NOTE_ADDED: 'Note added',
  LOST: 'Deal lost',
};

export const STAGE_PROBABILITY: Record<DealStage, number> = {
  NEW: 10,
  SITE_VISIT_SCHEDULED: 20,
  SITE_VISIT_COMPLETED: 35,
  NEGOTIATION: 50,
  TOKEN_PENDING: 60,
  TOKEN_RECEIVED: 70,
  DOCUMENTATION: 75,
  AGREEMENT_SCHEDULED: 85,
  AGREEMENT_COMPLETED: 90,
  COMMISSION_PENDING: 95,
  COMMISSION_RECEIVED: 98,
  CLOSED: 100,
  LOST: 0,
};

export function isDealStage(value: string): value is DealStage {
  return DEAL_STAGES.includes(value as DealStage);
}

export function isActiveDealStage(stage: DealStage): boolean {
  return stage !== 'CLOSED' && stage !== 'LOST';
}

export function probabilityTone(probability: number): 'high' | 'medium' | 'low' {
  if (probability >= 75) return 'high';
  if (probability >= 40) return 'medium';
  return 'low';
}

export function stageTone(stage: DealStage): string {
  if (stage === 'LOST') return 'bg-rose-100 text-rose-800';
  if (stage === 'CLOSED' || stage === 'COMMISSION_RECEIVED') return 'bg-emerald-100 text-emerald-800';
  if (stage.includes('AGREEMENT') || stage.includes('COMMISSION')) return 'bg-violet-100 text-violet-800';
  if (stage.includes('SITE_VISIT') || stage === 'NEGOTIATION') return 'bg-amber-100 text-amber-900';
  return 'bg-blue-100 text-blue-800';
}
