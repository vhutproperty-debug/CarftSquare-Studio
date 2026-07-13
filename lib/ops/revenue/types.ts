import type { RevenueStatus, RevenueStreamType } from '@/lib/ops/revenue/statuses';

export type OpsRevenueRecord = {
  id: string;
  dealId: string;
  dealNumber: string;
  broker?: string;
  brokerName?: string;
  clientName?: string;
  project?: string;
  streamType: RevenueStreamType;
  expectedAmount: number;
  invoicedAmount: number;
  collectedAmount: number;
  pendingAmount: number;
  status: RevenueStatus;
  dueDate?: string;
  collectedAt?: string;
  interiorReferral?: boolean;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  updatedBy?: string;
};

export type RevenueQueueItem = {
  id: string;
  record: OpsRevenueRecord;
};

export type RevenueWorkspaceMetrics = {
  expectedRevenue: number;
  pendingBrokerage: number;
  collectedRevenue: number;
  invoicedPending: number;
  overdueCount: number;
  interiorReferrals: number;
  brokerCount: number;
};

export type RevenueWorkspaceResult = {
  items: RevenueQueueItem[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
  metrics: RevenueWorkspaceMetrics;
  brokerBreakdown: Array<{ brokerId: string; brokerName: string; expected: number; collected: number; pending: number }>;
};

export function parseAmount(value?: string | number | null): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (!value) return 0;
  const digits = String(value).replace(/[^\d.]/g, '');
  const num = Number(digits);
  return Number.isFinite(num) ? num : 0;
}
