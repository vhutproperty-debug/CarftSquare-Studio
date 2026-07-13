import type { AgreementStatus, AgreementType } from '@/lib/ops/agreements/statuses';

export type OpsAgreementRecord = {
  id: string;
  dealId: string;
  dealNumber: string;
  broker?: string;
  brokerName?: string;
  clientName?: string;
  ownerName?: string;
  project?: string;
  agreementType: AgreementType;
  status: AgreementStatus;
  scheduledDate?: string;
  signedDate?: string;
  expiryDate?: string;
  agreementValue?: string;
  documentsComplete: boolean;
  renewalDueDate?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  updatedBy?: string;
};

export type AgreementWorkspaceMetrics = {
  totalAgreements: number;
  draft: number;
  scheduled: number;
  signed: number;
  expiringSoon: number;
  expired: number;
  pendingDocuments: number;
};

export type AgreementWorkspaceResult = {
  items: Array<{ id: string; record: OpsAgreementRecord }>;
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
  metrics: AgreementWorkspaceMetrics;
};
