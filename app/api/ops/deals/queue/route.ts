import { NextResponse } from 'next/server';
import { authResultToResponse } from '@/lib/auth/rbac/guard';
import { logOpsActivity } from '@/lib/ops/activity/store';
import { requireOpsEditAccess, requireOpsViewAccess } from '@/lib/ops/auth';
import { createDealSchema, dealQueueQuerySchema } from '@/lib/ops/deals/schemas';
import { createDealFromMatch, queryDealWorkspace } from '@/lib/ops/deals/query';
import { isDealStage } from '@/lib/ops/deals/statuses';

export async function GET(request: Request) {
  const auth = await requireOpsViewAccess(request);
  const denied = authResultToResponse(auth);
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  const parsed = dealQueueQuerySchema.safeParse({
    page: searchParams.get('page') || 1,
    pageSize: searchParams.get('pageSize') || 25,
    search: searchParams.get('search') || undefined,
    project: searchParams.get('project') || undefined,
    broker: searchParams.get('broker') || undefined,
    stage: searchParams.get('stage') || undefined,
    transactionType: searchParams.get('transactionType') || undefined,
    minProbability: searchParams.get('minProbability') || undefined,
    paymentStatus: searchParams.get('paymentStatus') || undefined,
    dateFrom: searchParams.get('dateFrom') || undefined,
    dateTo: searchParams.get('dateTo') || undefined,
    mineOnly: searchParams.get('mineOnly') || undefined,
    activeOnly: searchParams.get('activeOnly') || undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const result = await queryDealWorkspace({
      ...parsed.data,
      stage: parsed.data.stage && isDealStage(parsed.data.stage) ? parsed.data.stage : undefined,
    }, auth.admin);

    await logOpsActivity({
      action: 'view_deal_workspace',
      actorId: auth.admin.id,
      actorEmail: auth.admin.email,
      resource: 'ops_deal_workspace',
      details: { page: result.pagination.page, total: result.pagination.total },
      request,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('[ops-deals] queue_failed', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Unable to load deal workspace.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireOpsEditAccess(request);
  const denied = authResultToResponse(auth);
  if (denied) return denied;

  const body = await request.json().catch(() => null);
  const parsed = createDealSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const result = await createDealFromMatch(parsed.data.matchId, auth.admin);

    await logOpsActivity({
      action: 'create_deal_record',
      actorId: auth.admin.id,
      actorEmail: auth.admin.email,
      resource: 'ops_deal_record',
      resourceId: result.deal.id,
      details: { matchId: parsed.data.matchId, alreadyExists: result.alreadyExists || false },
      request,
    });

    if (result.alreadyExists) {
      return NextResponse.json(
        { deal: result.deal, alreadyExists: true, message: 'Deal already exists for this match.' },
        { status: 200 },
      );
    }

    return NextResponse.json({ deal: result.deal }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to create deal.';
    console.error('[ops-deals] create_failed', message);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
