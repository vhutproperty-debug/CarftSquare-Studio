import { NextResponse } from 'next/server';
import { authResultToResponse } from '@/lib/auth/rbac/guard';
import { logOpsActivity } from '@/lib/ops/activity/store';
import { requireOpsViewAccess } from '@/lib/ops/auth';
import { queryUnifiedLeads } from '@/lib/ops/leads/query';
import type { OpsLeadCategory, OpsLeadSource } from '@/lib/ops/leads/types';
import { isOpsLeadSource } from '@/lib/ops/leads/types';

export async function GET(request: Request) {
  const auth = await requireOpsViewAccess(request);
  const denied = authResultToResponse(auth);
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  const sourceParam = searchParams.get('source') || undefined;
  const categoryParam = searchParams.get('category') || undefined;

  if (sourceParam && !isOpsLeadSource(sourceParam)) {
    return NextResponse.json({ error: 'Invalid source filter.' }, { status: 400 });
  }

  try {
    const result = await queryUnifiedLeads({
      page: Number(searchParams.get('page') || 1),
      pageSize: Number(searchParams.get('pageSize') || 25),
      source: sourceParam as OpsLeadSource | undefined,
      category: categoryParam as OpsLeadCategory | undefined,
      search: searchParams.get('search') || undefined,
      dateFrom: searchParams.get('dateFrom') || undefined,
      dateTo: searchParams.get('dateTo') || undefined,
    });

    await logOpsActivity({
      action: 'view_leads_inbox',
      actorId: auth.admin.id,
      actorEmail: auth.admin.email,
      resource: 'ops_leads_inbox',
      details: {
        page: result.pagination.page,
        source: sourceParam || 'all',
        search: searchParams.get('search') || '',
      },
      request,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('[ops-leads] list_failed', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Unable to load leads.' }, { status: 500 });
  }
}
