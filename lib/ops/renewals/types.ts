import type { RenewalStatus } from '@/lib/ops/renewals/statuses';

export type OpsRenewalRecord = {
  id: string;
  agreementId: string;
  dealId: string;
  dealNumber: string;
  clientName?: string;
  project?: string;
  broker?: string;
  brokerName?: string;
  status: RenewalStatus;
  dueDate: string;
  renewedAt?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  updatedBy?: string;
};

export type RenewalWorkspaceMetrics = {
  upcoming: number;
  dueNow: number;
  renewed: number;
  lapsed: number;
};

export type RenewalWorkspaceResult = {
  items: Array<{ id: string; record: OpsRenewalRecord }>;
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
  metrics: RenewalWorkspaceMetrics;
};
