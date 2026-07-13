import type { DealStage, DealPaymentStatus, DealTransactionType } from '@/lib/ops/deals/statuses';
import type { OpsLeadSource } from '@/lib/ops/leads/types';

export type DealDocumentsChecklist = {
  clientKyc?: boolean;
  ownerKyc?: boolean;
  draftAgreement?: boolean;
  signedAgreement?: boolean;
  tokenReceipt?: boolean;
  commissionInvoice?: boolean;
  noc?: boolean;
  societyNoc?: boolean;
};

export type OpsDealRecord = {
  id: string;
  dealNumber: string;
  matchId: string;
  demandKey: string;
  demandSource: OpsLeadSource;
  demandSourceId: string;
  supplyId: string;
  broker?: string;
  brokerName?: string;
  clientName?: string;
  ownerName?: string;
  project?: string;
  building?: string;
  flat?: string;
  transactionType?: DealTransactionType;
  expectedRent?: string;
  expectedSaleValue?: string;
  expectedBrokerage?: string;
  interiorOpportunity?: boolean;
  stage: DealStage;
  probability: number;
  targetClosingDate?: string;
  siteVisitDate?: string;
  offerAmount?: string;
  negotiationNotes?: string;
  documentsChecklist: DealDocumentsChecklist;
  agreementDate?: string;
  agreementValue?: string;
  actualBrokerage?: string;
  paymentStatus?: DealPaymentStatus;
  commissionCollected?: string;
  lostReason?: string;
  internalNotes?: string;
  createdBy: string;
  createdByName?: string;
  createdAt: string;
  updatedAt: string;
  updatedBy?: string;
};

export type DealActivityType =
  | 'DEAL_CREATED'
  | 'STAGE_CHANGED'
  | 'OFFER_UPDATED'
  | 'SITE_VISIT_SCHEDULED'
  | 'SITE_VISIT_COMPLETED'
  | 'TOKEN_RECEIVED'
  | 'AGREEMENT_COMPLETED'
  | 'COMMISSION_RECEIVED'
  | 'DOCUMENT_UPDATED'
  | 'ASSIGNED'
  | 'NOTE_ADDED'
  | 'LOST';

export type OpsDealActivity = {
  id: string;
  dealId: string;
  type: DealActivityType;
  message: string;
  meta?: Record<string, unknown>;
  actorId: string;
  actorEmail?: string;
  actorName?: string;
  createdAt: string;
};

export type DealQueueItem = {
  id: string;
  deal: OpsDealRecord;
  lastActivityLabel?: string | null;
  assigneeInitials?: string;
};

export type DealWorkspaceMetrics = {
  activeDeals: number;
  siteVisits: number;
  negotiations: number;
  agreementPending: number;
  commissionPending: number;
  closedDeals: number;
  lostDeals: number;
  expectedRevenue: number;
  collectedRevenue: number;
};

export type DealWorkspaceResult = {
  items: DealQueueItem[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
  metrics: DealWorkspaceMetrics;
};

export function assigneeInitials(name?: string | null): string | undefined {
  if (!name?.trim()) return undefined;
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('');
}

export function defaultDocumentsChecklist(): DealDocumentsChecklist {
  return {
    clientKyc: false,
    ownerKyc: false,
    draftAgreement: false,
    signedAgreement: false,
    tokenReceipt: false,
    commissionInvoice: false,
    noc: false,
    societyNoc: false,
  };
}

export function parseBrokerageAmount(value?: string | null): number {
  if (!value) return 0;
  const digits = value.replace(/[^\d.]/g, '');
  const num = Number(digits);
  return Number.isFinite(num) ? num : 0;
}

export function dealDisplayLabel(deal: OpsDealRecord): string {
  const parts = [deal.building, deal.flat, deal.clientName].filter(Boolean);
  return parts.length ? parts.join(' · ') : deal.dealNumber;
}
