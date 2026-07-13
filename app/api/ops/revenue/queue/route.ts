import { NextResponse } from 'next/server';
import { authResultToResponse } from '@/lib/auth/rbac/guard';
import { logOpsActivity } from '@/lib/ops/activity/store';
import { requireOpsEditAccess, requireOpsViewAccess } from '@/lib/ops/auth';
import { revenueQueueQuerySchema } from '@/lib/ops/revenue/schemas';
import { queryRevenueWorkspace, syncRevenueFromDeals } from '@/lib/ops/revenue/query';
import { isRevenueStatus } from '@/lib/ops/revenue/statuses';

export async function GET(request: Request) {
  const auth = await requireOpsViewAccess(request);
  const denied = authResultToResponse(auth);
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  const parsed = revenueQueueQuerySchema.safeParse(Object.fromEntries(searchParams.entries()));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  try {
    const result = await queryRevenueWorkspace({
      ...parsed.data,
      status: parsed.data.status && isRevenueStatus(parsed.data.status) ? parsed.data.status : undefined,
    }, auth.admin);

    await logOpsActivity({
      action: 'view_revenue_workspace',
      actorId: auth.admin.id,
      actorEmail: auth.admin.email,
      resource: 'ops_revenue_workspace',
      request,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('[ops-revenue] queue_failed', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Unable to load revenue workspace.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireOpsEditAccess(request);
  const denied = authResultToResponse(auth);
  if (denied) return denied;

  try {
    const result = await syncRevenueFromDeals(auth.admin);
    await logOpsActivity({
      action: 'sync_revenue_records',
      actorId: auth.admin.id,
      actorEmail: auth.admin.email,
      resource: 'ops_revenue_sync',
      details: result,
      request,
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error('[ops-revenue] sync_failed', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Unable to sync revenue.' }, { status: 500 });
  }
}
