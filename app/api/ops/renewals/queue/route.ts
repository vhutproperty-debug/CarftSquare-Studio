import { NextResponse } from 'next/server';
import { authResultToResponse } from '@/lib/auth/rbac/guard';
import { logOpsActivity } from '@/lib/ops/activity/store';
import { requireOpsEditAccess, requireOpsViewAccess } from '@/lib/ops/auth';
import { queryRenewalWorkspace, generateRenewalsFromAgreements } from '@/lib/ops/renewals/query';
import { renewalQueueQuerySchema } from '@/lib/ops/renewals/schemas';
import { isRenewalStatus } from '@/lib/ops/renewals/statuses';

export async function GET(request: Request) {
  const auth = await requireOpsViewAccess(request);
  const denied = authResultToResponse(auth);
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  const parsed = renewalQueueQuerySchema.safeParse(Object.fromEntries(searchParams.entries()));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  try {
    const result = await queryRenewalWorkspace({
      ...parsed.data,
      status: parsed.data.status && isRenewalStatus(parsed.data.status) ? parsed.data.status : undefined,
    });

    await logOpsActivity({
      action: 'view_renewal_workspace',
      actorId: auth.admin.id,
      actorEmail: auth.admin.email,
      resource: 'ops_renewal_workspace',
      request,
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error('[ops-renewals] queue_failed', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Unable to load renewals.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireOpsEditAccess(request);
  const denied = authResultToResponse(auth);
  if (denied) return denied;

  const result = await generateRenewalsFromAgreements(auth.admin);
  await logOpsActivity({
    action: 'generate_renewal_records',
    actorId: auth.admin.id,
    actorEmail: auth.admin.email,
    resource: 'ops_renewal_generate',
    details: result,
    request,
  });
  return NextResponse.json(result);
}
