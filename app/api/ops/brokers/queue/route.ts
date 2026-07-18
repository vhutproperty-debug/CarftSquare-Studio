import { NextResponse } from 'next/server';
import { authResultToResponse } from '@/lib/auth/rbac/guard';
import { logOpsActivity } from '@/lib/ops/activity/store';
import { requireOpsViewAccess } from '@/lib/ops/auth';
import { brokerInventoryQueueQuerySchema } from '@/lib/ops/brokers/schemas';
import { queryBrokerWorkspace } from '@/lib/ops/brokers/query';

export async function GET(request: Request) {
  const auth = await requireOpsViewAccess(request);
  const denied = authResultToResponse(auth);
  if (denied) return denied;
  if (!auth.ok) return denied!;

  const { searchParams } = new URL(request.url);
  const parsed = brokerInventoryQueueQuerySchema.safeParse({
    page: searchParams.get('page') || 1,
    pageSize: searchParams.get('pageSize') || 25,
    search: searchParams.get('search') || undefined,
    project: searchParams.get('project') || undefined,
    transactionType: searchParams.get('transactionType') || undefined,
    bhk: searchParams.get('bhk') || undefined,
    freshness: searchParams.get('freshness') || undefined,
    broker: searchParams.get('broker') || undefined,
    group: searchParams.get('group') || undefined,
    furnishing: searchParams.get('furnishing') || undefined,
    status: searchParams.get('status') || undefined,
    sort: searchParams.get('sort') || undefined,
    sortDir: searchParams.get('sortDir') || undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const result = await queryBrokerWorkspace(parsed.data);

    await logOpsActivity({
      action: 'view_broker_inventory_workspace',
      actorId: auth.admin.id,
      actorEmail: auth.admin.email,
      resource: 'ops_broker_inventory',
      details: { page: result.pagination.page, total: result.pagination.total },
      request,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('[ops-brokers] queue_failed', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Unable to load broker inventory.' }, { status: 500 });
  }
}
