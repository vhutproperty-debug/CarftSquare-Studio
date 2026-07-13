import { NextResponse } from 'next/server';
import { authResultToResponse } from '@/lib/auth/rbac/guard';
import { logOpsActivity } from '@/lib/ops/activity/store';
import { requireOpsEditAccess, requireOpsViewAccess } from '@/lib/ops/auth';
import { agreementQueueQuerySchema } from '@/lib/ops/agreements/schemas';
import { queryAgreementWorkspace, syncAgreementsFromDeals } from '@/lib/ops/agreements/query';
import { isAgreementStatus } from '@/lib/ops/agreements/statuses';

export async function GET(request: Request) {
  const auth = await requireOpsViewAccess(request);
  const denied = authResultToResponse(auth);
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  const parsed = agreementQueueQuerySchema.safeParse(Object.fromEntries(searchParams.entries()));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  try {
    const result = await queryAgreementWorkspace({
      ...parsed.data,
      status: parsed.data.status && isAgreementStatus(parsed.data.status) ? parsed.data.status : undefined,
    });

    await logOpsActivity({ action: 'view_agreement_workspace', actorId: auth.admin.id, actorEmail: auth.admin.email, resource: 'ops_agreement_workspace', request });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: 'Unable to load agreements.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireOpsEditAccess(request);
  const denied = authResultToResponse(auth);
  if (denied) return denied;

  const result = await syncAgreementsFromDeals(auth.admin);
  await logOpsActivity({ action: 'sync_agreement_records', actorId: auth.admin.id, actorEmail: auth.admin.email, resource: 'ops_agreement_sync', details: result, request });
  return NextResponse.json(result);
}
