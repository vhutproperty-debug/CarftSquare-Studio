import type { Db } from 'mongodb';
// @ts-expect-error JS module without types
import { getDb } from '@/lib/mongodb';
import type { OpsDealRecord } from '@/lib/ops/deals/types';
import { listDealRecords } from '@/lib/ops/deals/store';
import type { AgreementWorkspaceMetrics, AgreementWorkspaceResult, OpsAgreementRecord } from '@/lib/ops/agreements/types';
import type { AgreementStatus, AgreementType } from '@/lib/ops/agreements/statuses';
import { expiryStatus } from '@/lib/ops/agreements/statuses';
import {
  createAgreementRecord,
  getAgreementByDealId,
  getAgreementRecord,
  listAgreementRecords,
  updateAgreementRecord,
} from '@/lib/ops/agreements/store';
import type { PublicAdminUser } from '@/lib/auth/rbac/types';

const AGREEMENT_ELIGIBLE = new Set([
  'DOCUMENTATION',
  'AGREEMENT_SCHEDULED',
  'AGREEMENT_COMPLETED',
  'COMMISSION_PENDING',
  'COMMISSION_RECEIVED',
  'CLOSED',
]);

function typeFromDeal(deal: OpsDealRecord): AgreementType {
  return deal.transactionType === 'sale' ? 'sale' : 'rental';
}

function docsComplete(deal: OpsDealRecord): boolean {
  const d = deal.documentsChecklist;
  return !!(d.signedAgreement && d.clientKyc && d.ownerKyc);
}

function statusFromDeal(deal: OpsDealRecord): AgreementStatus {
  if (deal.stage === 'AGREEMENT_COMPLETED' || deal.stage === 'COMMISSION_RECEIVED' || deal.stage === 'CLOSED') return 'SIGNED';
  if (deal.stage === 'AGREEMENT_SCHEDULED') return 'SCHEDULED';
  const exp = expiryStatus(deal.agreementDate);
  if (exp) return exp;
  return 'DRAFT';
}

export function computeAgreementMetrics(records: OpsAgreementRecord[]): AgreementWorkspaceMetrics {
  return {
    totalAgreements: records.length,
    draft: records.filter((r) => r.status === 'DRAFT').length,
    scheduled: records.filter((r) => r.status === 'SCHEDULED').length,
    signed: records.filter((r) => r.status === 'SIGNED' || r.status === 'REGISTERED').length,
    expiringSoon: records.filter((r) => r.status === 'EXPIRING').length,
    expired: records.filter((r) => r.status === 'EXPIRED').length,
    pendingDocuments: records.filter((r) => !r.documentsComplete).length,
  };
}

export async function syncAgreementsFromDeals(actor: PublicAdminUser, db?: Db) {
  const database = db || await getDb();
  const deals = await listDealRecords(database);
  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const deal of deals) {
    if (!AGREEMENT_ELIGIBLE.has(deal.stage)) {
      skipped += 1;
      continue;
    }
    const existing = await getAgreementByDealId(database, deal.id);
    const expiry = deal.agreementDate ? new Date(deal.agreementDate).toISOString() : undefined;
    let status = statusFromDeal(deal);
    const expHint = expiryStatus(expiry);
    if (expHint && status !== 'SIGNED') status = expHint;

    const payload = {
      dealNumber: deal.dealNumber,
      broker: deal.broker,
      brokerName: deal.brokerName,
      clientName: deal.clientName,
      ownerName: deal.ownerName,
      project: deal.project,
      agreementType: typeFromDeal(deal),
      status,
      scheduledDate: deal.stage === 'AGREEMENT_SCHEDULED' ? deal.targetClosingDate : undefined,
      signedDate: deal.agreementDate,
      expiryDate: expiry,
      agreementValue: deal.agreementValue,
      documentsComplete: docsComplete(deal),
      notes: deal.internalNotes,
      updatedBy: actor.id,
    };

    if (existing) {
      await updateAgreementRecord(database, existing.id, payload);
      updated += 1;
    } else {
      await createAgreementRecord(database, { dealId: deal.id, ...payload });
      created += 1;
    }
  }

  return { created, updated, skipped };
}

export async function queryAgreementWorkspace(
  params: { page?: number; pageSize?: number; search?: string; status?: AgreementStatus; expiringOnly?: boolean; broker?: string },
  db?: Db,
): Promise<AgreementWorkspaceResult> {
  const database = db || await getDb();
  const page = params.page || 1;
  const pageSize = params.pageSize || 25;
  let all = await listAgreementRecords(database);

  if (params.search) {
    const q = params.search.toLowerCase();
    all = all.filter((r) => [r.dealNumber, r.clientName, r.project].join(' ').toLowerCase().includes(q));
  }
  if (params.status) all = all.filter((r) => r.status === params.status);
  if (params.broker) all = all.filter((r) => r.broker === params.broker);
  if (params.expiringOnly) all = all.filter((r) => r.status === 'EXPIRING' || r.status === 'EXPIRED');

  all.sort((a, b) => (a.expiryDate || '').localeCompare(b.expiryDate || ''));
  const total = all.length;
  const items = all.slice((page - 1) * pageSize, page * pageSize).map((record) => ({ id: record.id, record }));

  return {
    items,
    pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
    metrics: computeAgreementMetrics(await listAgreementRecords(database)),
  };
}

export async function getAgreementDetail(id: string, db?: Db) {
  const database = db || await getDb();
  const record = await getAgreementRecord(database, id);
  if (!record) return null;
  const { getDealRecord } = await import('@/lib/ops/deals/store');
  const deal = await getDealRecord(database, record.dealId);
  return { record, deal };
}

export { getDb as getDatabase };
