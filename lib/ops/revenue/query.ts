/**
 * Revenue workspace — reads deals (read-only), writes ops_revenue_records.
 */
import type { Db } from 'mongodb';
// @ts-expect-error JS module without types
import { getDb } from '@/lib/mongodb';
import type { OpsDealRecord } from '@/lib/ops/deals/types';
import { parseBrokerageAmount } from '@/lib/ops/deals/types';
import { listDealRecords } from '@/lib/ops/deals/store';
import type { RevenueWorkspaceMetrics, RevenueWorkspaceResult, OpsRevenueRecord } from '@/lib/ops/revenue/types';
import { parseAmount } from '@/lib/ops/revenue/types';
import type { RevenueStatus, RevenueStreamType } from '@/lib/ops/revenue/statuses';
import {
  createRevenueRecord,
  getRevenueByDealId,
  getRevenueRecord,
  listRevenueRecords,
  updateRevenueRecord,
} from '@/lib/ops/revenue/store';
import type { PublicAdminUser } from '@/lib/auth/rbac/types';

export type RevenueQueryParams = {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: RevenueStatus;
  broker?: string;
  streamType?: RevenueStreamType;
  overdueOnly?: boolean;
  mineOnly?: boolean;
};

const REVENUE_ELIGIBLE_STAGES = new Set([
  'AGREEMENT_COMPLETED',
  'COMMISSION_PENDING',
  'COMMISSION_RECEIVED',
  'CLOSED',
  'DOCUMENTATION',
  'AGREEMENT_SCHEDULED',
]);

function streamFromDeal(deal: OpsDealRecord): RevenueStreamType {
  if (deal.interiorOpportunity) return 'interior_referral';
  return deal.transactionType === 'sale' ? 'sale_brokerage' : 'rental_brokerage';
}

function expectedFromDeal(deal: OpsDealRecord): number {
  return parseBrokerageAmount(deal.actualBrokerage || deal.expectedBrokerage);
}

function statusFromDeal(deal: OpsDealRecord, expected: number, collected: number): RevenueStatus {
  if (deal.paymentStatus === 'COLLECTED' || collected >= expected && expected > 0) return 'COLLECTED';
  if (collected > 0 && collected < expected) return 'PARTIAL';
  if (deal.stage === 'COMMISSION_PENDING') return 'INVOICED';
  if (deal.targetClosingDate && new Date(deal.targetClosingDate) < new Date() && collected < expected) return 'OVERDUE';
  return 'EXPECTED';
}

export function computeRevenueMetrics(records: OpsRevenueRecord[]): RevenueWorkspaceMetrics {
  const now = Date.now();
  return {
    expectedRevenue: records.reduce((s, r) => s + r.expectedAmount, 0),
    pendingBrokerage: records.reduce((s, r) => s + r.pendingAmount, 0),
    collectedRevenue: records.reduce((s, r) => s + r.collectedAmount, 0),
    invoicedPending: records.filter((r) => r.status === 'INVOICED' || r.status === 'PARTIAL').length,
    overdueCount: records.filter((r) => r.status === 'OVERDUE' || (r.dueDate && new Date(r.dueDate).getTime() < now && r.pendingAmount > 0)).length,
    interiorReferrals: records.filter((r) => r.interiorReferral || r.streamType === 'interior_referral').length,
    brokerCount: new Set(records.map((r) => r.broker).filter(Boolean)).size,
  };
}

function brokerBreakdown(records: OpsRevenueRecord[]) {
  const map = new Map<string, { brokerId: string; brokerName: string; expected: number; collected: number; pending: number }>();
  for (const r of records) {
    const key = r.broker || 'unassigned';
    const row = map.get(key) || { brokerId: key, brokerName: r.brokerName || 'Unassigned', expected: 0, collected: 0, pending: 0 };
    row.expected += r.expectedAmount;
    row.collected += r.collectedAmount;
    row.pending += r.pendingAmount;
    map.set(key, row);
  }
  return [...map.values()].sort((a, b) => b.pending - a.pending);
}

function filterRecords(records: OpsRevenueRecord[], params: RevenueQueryParams, userId?: string): OpsRevenueRecord[] {
  const now = Date.now();
  return records.filter((r) => {
    if (params.search) {
      const q = params.search.toLowerCase();
      const hay = [r.dealNumber, r.clientName, r.project, r.brokerName].filter(Boolean).join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (params.status && r.status !== params.status) return false;
    if (params.broker && r.broker !== params.broker) return false;
    if (params.streamType && r.streamType !== params.streamType) return false;
    if (params.mineOnly && userId && r.broker !== userId) return false;
    if (params.overdueOnly && !(r.status === 'OVERDUE' || (r.dueDate && new Date(r.dueDate).getTime() < now && r.pendingAmount > 0))) return false;
    return true;
  });
}

export async function syncRevenueFromDeals(actor: PublicAdminUser, db?: Db): Promise<{ created: number; updated: number; skipped: number }> {
  const database = db || await getDb();
  const deals = await listDealRecords(database);
  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const deal of deals) {
    if (!REVENUE_ELIGIBLE_STAGES.has(deal.stage) && deal.stage !== 'LOST') {
      skipped += 1;
      continue;
    }
    if (deal.stage === 'LOST') {
      skipped += 1;
      continue;
    }

    const expected = expectedFromDeal(deal);
    const collected = parseAmount(deal.commissionCollected);
    const pending = Math.max(0, expected - collected);
    const status = statusFromDeal(deal, expected, collected);
    const existing = await getRevenueByDealId(database, deal.id);

    if (existing) {
      await updateRevenueRecord(database, existing.id, {
        expectedAmount: expected,
        collectedAmount: collected,
        pendingAmount: pending,
        status,
        dueDate: deal.targetClosingDate || existing.dueDate || null,
        interiorReferral: deal.interiorOpportunity,
        updatedBy: actor.id,
      });
      updated += 1;
    } else if (expected > 0 || collected > 0) {
      await createRevenueRecord(database, {
        dealId: deal.id,
        dealNumber: deal.dealNumber,
        broker: deal.broker,
        brokerName: deal.brokerName,
        clientName: deal.clientName,
        project: deal.project,
        streamType: streamFromDeal(deal),
        expectedAmount: expected,
        invoicedAmount: status === 'INVOICED' ? expected : 0,
        collectedAmount: collected,
        pendingAmount: pending,
        status,
        dueDate: deal.targetClosingDate,
        collectedAt: deal.paymentStatus === 'COLLECTED' ? new Date().toISOString() : undefined,
        interiorReferral: deal.interiorOpportunity,
        notes: deal.internalNotes,
        updatedBy: actor.id,
      });
      created += 1;
    } else {
      skipped += 1;
    }
  }

  return { created, updated, skipped };
}

export async function queryRevenueWorkspace(params: RevenueQueryParams, actor?: PublicAdminUser, db?: Db): Promise<RevenueWorkspaceResult> {
  const database = db || await getDb();
  const page = params.page || 1;
  const pageSize = params.pageSize || 25;
  const all = await listRevenueRecords(database);
  const filtered = filterRecords(all, params, actor?.id);
  filtered.sort((a, b) => b.pendingAmount - a.pendingAmount || b.updatedAt.localeCompare(a.updatedAt));
  const total = filtered.length;
  const items = filtered.slice((page - 1) * pageSize, page * pageSize).map((record) => ({ id: record.id, record }));

  return {
    items,
    pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
    metrics: computeRevenueMetrics(all),
    brokerBreakdown: brokerBreakdown(all),
  };
}

export async function getRevenueDetail(id: string, db?: Db) {
  const database = db || await getDb();
  const record = await getRevenueRecord(database, id);
  if (!record) return null;
  const { getDealRecord } = await import('@/lib/ops/deals/store');
  const deal = await getDealRecord(database, record.dealId);
  return { record, deal };
}

export { getDb as getDatabase };
