import { NextResponse } from 'next/server';
import { canOps, recordVisibleTo, scopeRecords, seesAllRecords, type AccessActor, type AssignedKind, type OpsPermission } from '@/lib/ops/os/permissions';
import { presentForActor } from '@/lib/ops/os/redact';
import { phaseDisabledResponse, phaseEnabled, type OsPhase } from '@/lib/ops/os/flags';

export function forbidUnlessOps(actor: AccessActor, permission: OpsPermission): NextResponse | null {
  if (canOps(actor, permission)) return null;
  return NextResponse.json({ error: 'You do not have permission to perform this action.' }, { status: 403 });
}

export function forbidUnlessPhase(phase: OsPhase): NextResponse | null {
  if (phaseEnabled(phase)) return null;
  return NextResponse.json(phaseDisabledResponse(phase), { status: 404 });
}

export function hiddenRecordResponse(): NextResponse {
  return NextResponse.json({ error: 'Record not found.' }, { status: 404 });
}

export function releaseRecord<T extends object>(
  actor: AccessActor,
  record: T | null | undefined,
  kind: AssignedKind,
): T | null {
  if (!record || !recordVisibleTo(actor, record, kind)) return null;
  return presentForActor(actor, record);
}

type QueueShape = {
  items?: unknown[];
  pagination?: { page: number; pageSize: number; total: number; totalPages: number };
  [key: string]: unknown;
};

function itemRecord(item: unknown): object | null {
  if (!item || typeof item !== 'object') return null;
  const row = item as Record<string, unknown>;
  if (row.record && typeof row.record === 'object') return row.record as object;
  if (row.deal && typeof row.deal === 'object') return row.deal as object;
  if (row.contact && typeof row.contact === 'object') return row.contact as object;
  if (row.demand && typeof row.demand === 'object') return row.demand as object;
  return row;
}

export function releaseWorkspace<T extends QueueShape>(actor: AccessActor, result: T, kind: AssignedKind): T {
  if (seesAllRecords(actor)) return presentForActor(actor, result);
  const items = Array.isArray(result.items) ? result.items : [];
  const visible = items.filter((item) => {
    const record = itemRecord(item);
    return record ? recordVisibleTo(actor, record, kind) : true;
  });
  const pagination = result.pagination
    ? {
      ...result.pagination,
      total: visible.length,
      totalPages: Math.max(1, Math.ceil(visible.length / Math.max(1, result.pagination.pageSize || visible.length || 1))),
    }
    : result.pagination;
  return presentForActor(actor, { ...result, items: visible, pagination });
}

export function releaseList<T extends object>(actor: AccessActor, records: T[], kind: AssignedKind): T[] {
  return presentForActor(actor, scopeRecords(actor, records, kind));
}
