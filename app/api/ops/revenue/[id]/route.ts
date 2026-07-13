import { NextResponse } from 'next/server';
import { authResultToResponse } from '@/lib/auth/rbac/guard';
import { logOpsActivity } from '@/lib/ops/activity/store';
import { requireOpsEditAccess, requireOpsViewAccess } from '@/lib/ops/auth';
import { patchRevenueRecordSchema } from '@/lib/ops/revenue/schemas';
import { getRevenueDetail } from '@/lib/ops/revenue/query';
import { getDatabase, updateRevenueRecord } from '@/lib/ops/revenue/store';

type RouteContext = { params: { id: string } };

export async function GET(request: Request, context: RouteContext) {
  const auth = await requireOpsViewAccess(request);
  const denied = authResultToResponse(auth);
  if (denied) return denied;

  const detail = await getRevenueDetail(context.params.id);
  if (!detail) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  return NextResponse.json(detail);
}

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireOpsEditAccess(request);
  const denied = authResultToResponse(auth);
  if (denied) return denied;

  const body = await request.json().catch(() => null);
  const parsed = patchRevenueRecordSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const db = await getDatabase();
  const patch = parsed.data;
  const update: Parameters<typeof updateRevenueRecord>[2] = { updatedBy: auth.admin.id };

  if (patch.expectedAmount !== undefined) update.expectedAmount = patch.expectedAmount;
  if (patch.invoicedAmount !== undefined) update.invoicedAmount = patch.invoicedAmount;
  if (patch.collectedAmount !== undefined) update.collectedAmount = patch.collectedAmount;
  if (patch.status) update.status = patch.status;
  if (patch.interiorReferral !== undefined) update.interiorReferral = patch.interiorReferral;
  if (patch.notes !== undefined) update.notes = patch.notes;
  if (patch.dueDate !== undefined) update.dueDate = patch.dueDate || null;
  if (patch.collectedAt !== undefined) update.collectedAt = patch.collectedAt || null;

  if (update.expectedAmount !== undefined || update.collectedAmount !== undefined) {
    const existing = await getRevenueDetail(context.params.id);
    const expected = update.expectedAmount ?? existing?.record.expectedAmount ?? 0;
    const collected = update.collectedAmount ?? existing?.record.collectedAmount ?? 0;
    update.pendingAmount = Math.max(0, expected - collected);
  }

  const record = await updateRevenueRecord(db, context.params.id, update);
  if (!record) return NextResponse.json({ error: 'Unable to update.' }, { status: 500 });

  await logOpsActivity({
    action: 'update_revenue_record',
    actorId: auth.admin.id,
    actorEmail: auth.admin.email,
    resource: 'ops_revenue_record',
    resourceId: context.params.id,
    request,
  });

  return NextResponse.json({ record });
}
