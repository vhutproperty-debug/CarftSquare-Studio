import { NextResponse } from 'next/server';
import { authResultToResponse } from '@/lib/auth/rbac/guard';
import { logOpsActivity } from '@/lib/ops/activity/store';
import { requireOpsViewAccess } from '@/lib/ops/auth';
import { matchingQueueQuerySchema } from '@/lib/ops/matching/schemas';
import { queryMatchingWorkspace } from '@/lib/ops/matching/query';
import { isMatchStatus } from '@/lib/ops/matching/statuses';

export async function GET(request: Request) {
  const auth = await requireOpsViewAccess(request);
  const denied = authResultToResponse(auth);
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  const parsed = matchingQueueQuerySchema.safeParse({
    page: searchParams.get('page') || 1,
    pageSize: searchParams.get('pageSize') || 25,
    search: searchParams.get('search') || undefined,
    project: searchParams.get('project') || undefined,
    broker: searchParams.get('broker') || undefined,
    configuration: searchParams.get('configuration') || undefined,
    listingType: searchParams.get('listingType') || undefined,
    minScore: searchParams.get('minScore') || undefined,
    status: searchParams.get('status') || undefined,
    assignedBroker: searchParams.get('assignedBroker') || undefined,
    dateFrom: searchParams.get('dateFrom') || undefined,
    dateTo: searchParams.get('dateTo') || undefined,
    mineOnly: searchParams.get('mineOnly') || undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const statusParam = parsed.data.status;

  try {
    const result = await queryMatchingWorkspace({
      ...parsed.data,
      status: statusParam && isMatchStatus(statusParam) ? statusParam : undefined,
    }, auth.admin);

    await logOpsActivity({
      action: 'view_matching_workspace',
      actorId: auth.admin.id,
      actorEmail: auth.admin.email,
      resource: 'ops_matching_workspace',
      details: { page: result.pagination.page, total: result.pagination.total },
      request,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('[ops-matching] queue_failed', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Unable to load matching workspace.' }, { status: 500 });
  }
}
