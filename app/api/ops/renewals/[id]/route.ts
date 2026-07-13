import { NextResponse } from 'next/server';
import { authResultToResponse } from '@/lib/auth/rbac/guard';
import { logOpsActivity } from '@/lib/ops/activity/store';
import { requireOpsEditAccess, requireOpsViewAccess } from '@/lib/ops/auth';
import { getRenewalDetail } from '@/lib/ops/renewals/query';
import { patchRenewalRecordSchema } from '@/lib/ops/renewals/schemas';
import { getDatabase, updateRenewalRecord } from '@/lib/ops/renewals/store';

type RouteContext = { params: { id: string } };

export async function GET(request: Request, context: RouteContext) {
  const auth = await requireOpsViewAccess(request);
  const denied = authResultToResponse(auth);
  if (denied) return denied;

  const detail = await getRenewalDetail(context.params.id);
  if (!detail) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  return NextResponse.json(detail);
}

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireOpsEditAccess(request);
  const denied = authResultToResponse(auth);
  if (denied) return denied;

  const body = await request.json().catch(() => null);
  const parsed = patchRenewalRecordSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const db = await getDatabase();
  const patch = parsed.data;
  const record = await updateRenewalRecord(db, context.params.id, {
    status: patch.status,
    renewedAt: patch.status === 'RENEWED' ? new Date().toISOString() : undefined,
    notes: patch.notes,
    updatedBy: auth.admin.id,
  });
  if (!record) return NextResponse.json({ error: 'Unable to update.' }, { status: 500 });

  await logOpsActivity({
    action: 'update_renewal_record',
    actorId: auth.admin.id,
    actorEmail: auth.admin.email,
    resource: 'ops_renewal_record',
    resourceId: context.params.id,
    request,
  });

  return NextResponse.json({ record });
}
