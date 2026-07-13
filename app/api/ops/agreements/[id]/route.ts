import { NextResponse } from 'next/server';
import { authResultToResponse } from '@/lib/auth/rbac/guard';
import { logOpsActivity } from '@/lib/ops/activity/store';
import { requireOpsEditAccess, requireOpsViewAccess } from '@/lib/ops/auth';
import { patchAgreementRecordSchema } from '@/lib/ops/agreements/schemas';
import { getAgreementDetail } from '@/lib/ops/agreements/query';
import { getDatabase, updateAgreementRecord } from '@/lib/ops/agreements/store';

type RouteContext = { params: { id: string } };

export async function GET(request: Request, context: RouteContext) {
  const auth = await requireOpsViewAccess(request);
  const denied = authResultToResponse(auth);
  if (denied) return denied;

  const detail = await getAgreementDetail(context.params.id);
  if (!detail) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  return NextResponse.json(detail);
}

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireOpsEditAccess(request);
  const denied = authResultToResponse(auth);
  if (denied) return denied;

  const body = await request.json().catch(() => null);
  const parsed = patchAgreementRecordSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const db = await getDatabase();
  const record = await updateAgreementRecord(db, context.params.id, { ...parsed.data, updatedBy: auth.admin.id } as Parameters<typeof updateAgreementRecord>[2]);
  if (!record) return NextResponse.json({ error: 'Unable to update.' }, { status: 500 });

  await logOpsActivity({
    action: 'update_agreement_record',
    actorId: auth.admin.id,
    actorEmail: auth.admin.email,
    resource: 'ops_agreement_record',
    resourceId: context.params.id,
    request,
  });
  return NextResponse.json({ record });
}
