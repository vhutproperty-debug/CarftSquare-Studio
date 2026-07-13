import { NextResponse } from 'next/server';
import { authResultToResponse } from '@/lib/auth/rbac/guard';
import { logOpsActivity } from '@/lib/ops/activity/store';
import { requireOpsViewAccess } from '@/lib/ops/auth';
import { demandQueueQuerySchema } from '@/lib/ops/demand/schemas';
import { queryDemandWorkspace } from '@/lib/ops/demand/query';
import type { OpsLeadCategory, OpsLeadSource } from '@/lib/ops/leads/types';
import { isOpsLeadSource } from '@/lib/ops/leads/types';
import type { DemandPriority, DemandStatus } from '@/lib/ops/demand/statuses';
import { isDemandPriority, isDemandStatus } from '@/lib/ops/demand/statuses';

export async function GET(request: Request) {
  const auth = await requireOpsViewAccess(request);
  const denied = authResultToResponse(auth);
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  const parsed = demandQueueQuerySchema.safeParse({
    page: searchParams.get('page') || 1,
    pageSize: searchParams.get('pageSize') || 25,
    source: searchParams.get('source') || undefined,
    category: searchParams.get('category') || undefined,
    search: searchParams.get('search') || undefined,
    dateFrom: searchParams.get('dateFrom') || undefined,
    dateTo: searchParams.get('dateTo') || undefined,
    status: searchParams.get('status') || undefined,
    priority: searchParams.get('priority') || undefined,
    assignedTo: searchParams.get('assignedTo') || undefined,
    mineOnly: searchParams.get('mineOnly') || undefined,
    rentBuy: searchParams.get('rentBuy') || undefined,
    project: searchParams.get('project') || undefined,
    building: searchParams.get('building') || undefined,
    followUpToday: searchParams.get('followUpToday') || undefined,
    overdueOnly: searchParams.get('overdueOnly') || undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const sourceParam = parsed.data.source;
  if (sourceParam && !isOpsLeadSource(sourceParam)) {
    return NextResponse.json({ error: 'Invalid source filter.' }, { status: 400 });
  }

  const statusParam = parsed.data.status;
  const priorityParam = parsed.data.priority;

  try {
    const result = await queryDemandWorkspace({
      page: parsed.data.page,
      pageSize: parsed.data.pageSize,
      source: sourceParam as OpsLeadSource | undefined,
      category: parsed.data.category as OpsLeadCategory | undefined,
      search: parsed.data.search,
      dateFrom: parsed.data.dateFrom,
      dateTo: parsed.data.dateTo,
      status: statusParam && isDemandStatus(statusParam) ? statusParam : undefined,
      priority: priorityParam && isDemandPriority(priorityParam) ? priorityParam : undefined,
      assignedTo: parsed.data.assignedTo,
      mineOnly: parsed.data.mineOnly,
      rentBuy: parsed.data.rentBuy,
      project: parsed.data.project,
      building: parsed.data.building,
      followUpToday: parsed.data.followUpToday,
      overdueOnly: parsed.data.overdueOnly,
    }, auth.admin);

    await logOpsActivity({
      action: 'view_demand_workspace',
      actorId: auth.admin.id,
      actorEmail: auth.admin.email,
      resource: 'ops_demand_workspace',
      details: { page: result.pagination.page, total: result.pagination.total },
      request,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('[ops-demand] queue_failed', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Unable to load demand workspace.' }, { status: 500 });
  }
}
