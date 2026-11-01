import { NextResponse } from 'next/server';
import { authResultToResponse } from '@/lib/auth/rbac/guard';
import { logOpsActivity } from '@/lib/ops/activity/store';
import { requireOpsViewAccess } from '@/lib/ops/auth';
import { getBrokerCrmDatabase, listBrokerCrm } from '@/lib/ops/broker-crm/store';
import { isBrokerCrmStatus, type BrokerCrmListQuery } from '@/lib/ops/broker-crm/types';

export const runtime = 'nodejs';

function sortOf(value: string | null): BrokerCrmListQuery['sort'] {
  if (value === 'name' || value === 'groupCount' || value === 'lastContacted' || value === 'priority') return value;
  return 'priority';
}

export async function GET(request: Request) {
  const auth = await requireOpsViewAccess(request);
  if (!auth.ok) {
    return authResultToResponse(auth) ?? NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const statusParam = url.searchParams.get('status') || 'all';
  try {
    const result = await listBrokerCrm(await getBrokerCrmDatabase(), {
      search: url.searchParams.get('search') || '',
      group: url.searchParams.get('group') || '',
      area: url.searchParams.get('area') || '',
      status: statusParam !== 'all' && isBrokerCrmStatus(statusParam) ? statusParam : 'all',
      priorityOnly: url.searchParams.get('priority') === '1',
      sort: sortOf(url.searchParams.get('sort')),
      sortDir: url.searchParams.get('sortDir') === 'asc' ? 'asc' : 'desc',
      page: Number(url.searchParams.get('page') || 1),
      pageSize: Number(url.searchParams.get('pageSize') || 25),
    });
    await logOpsActivity({
      action: 'view_broker_crm',
      actorId: auth.admin.id,
      actorEmail: auth.admin.email,
      resource: 'ops_broker_crm',
      details: { total: result.metrics.total, shown: result.pagination.total },
      request,
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error('[ops-broker-crm] list_failed', error instanceof Error ? error.message : 'error');
    return NextResponse.json({ error: 'Unable to load brokers.' }, { status: 500 });
  }
}
