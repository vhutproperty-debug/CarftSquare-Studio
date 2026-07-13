import type { Db } from 'mongodb';
// @ts-expect-error JS module without types
import { getDb } from '@/lib/mongodb';
import { listAgreementRecords } from '@/lib/ops/agreements/store';
import type { RenewalWorkspaceMetrics, RenewalWorkspaceResult } from '@/lib/ops/renewals/types';
import type { RenewalStatus } from '@/lib/ops/renewals/statuses';
import {
  createRenewalRecord,
  getRenewalByAgreementId,
  getRenewalRecord,
  listRenewalRecords,
  updateRenewalRecord,
} from '@/lib/ops/renewals/store';
import type { PublicAdminUser } from '@/lib/auth/rbac/types';

function renewalStatusFromDueDate(dueDate: string): RenewalStatus {
  const due = new Date(dueDate).getTime();
  const now = Date.now();
  const fourteenDays = 14 * 24 * 60 * 60 * 1000;
  if (due < now - fourteenDays) return 'LAPSED';
  if (due <= now) return 'DUE';
  return 'UPCOMING';
}

export function computeRenewalMetrics(records: Awaited<ReturnType<typeof listRenewalRecords>>): RenewalWorkspaceMetrics {
  return {
    upcoming: records.filter((r) => r.status === 'UPCOMING').length,
    dueNow: records.filter((r) => r.status === 'DUE').length,
    renewed: records.filter((r) => r.status === 'RENEWED').length,
    lapsed: records.filter((r) => r.status === 'LAPSED').length,
  };
}

export async function generateRenewalsFromAgreements(actor: PublicAdminUser, db?: Db) {
  const database = db || await getDb();
  const agreements = await listAgreementRecords(database);
  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const agreement of agreements) {
    const dueDate = agreement.renewalDueDate || agreement.expiryDate;
    if (!dueDate || agreement.status === 'DRAFT') {
      skipped += 1;
      continue;
    }

    const existing = await getRenewalByAgreementId(database, agreement.id);
    const status = existing?.status === 'RENEWED' ? 'RENEWED' : renewalStatusFromDueDate(dueDate);

    if (existing) {
      if (existing.status !== 'RENEWED') {
        await updateRenewalRecord(database, existing.id, { status, updatedBy: actor.id });
        updated += 1;
      } else skipped += 1;
    } else {
      await createRenewalRecord(database, {
        agreementId: agreement.id,
        dealId: agreement.dealId,
        dealNumber: agreement.dealNumber,
        clientName: agreement.clientName,
        project: agreement.project,
        broker: agreement.broker,
        brokerName: agreement.brokerName,
        status,
        dueDate,
        updatedBy: actor.id,
      });
      created += 1;
    }
  }

  return { created, updated, skipped };
}

export async function queryRenewalWorkspace(
  params: { page?: number; pageSize?: number; status?: RenewalStatus },
  db?: Db,
): Promise<RenewalWorkspaceResult> {
  const database = db || await getDb();
  const page = params.page || 1;
  const pageSize = params.pageSize || 25;
  let all = await listRenewalRecords(database);
  if (params.status) all = all.filter((r) => r.status === params.status);
  all.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const total = all.length;
  const allRecords = await listRenewalRecords(database);

  return {
    items: all.slice((page - 1) * pageSize, page * pageSize).map((record) => ({ id: record.id, record })),
    pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
    metrics: computeRenewalMetrics(allRecords),
  };
}

export async function getRenewalDetail(id: string, db?: Db) {
  const database = db || await getDb();
  const record = await getRenewalRecord(database, id);
  if (!record) return null;
  const { getAgreementRecord } = await import('@/lib/ops/agreements/store');
  const agreement = await getAgreementRecord(database, record.agreementId);
  return { record, agreement };
}

export { getDb as getDatabase };
