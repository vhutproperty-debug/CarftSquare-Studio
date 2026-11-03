import { NextResponse } from 'next/server';
import { authResultToResponse } from '@/lib/auth/rbac/guard';
import { requireOpsViewAccess } from '@/lib/ops/auth';
import { forbidUnlessPhase, releaseList } from '@/lib/ops/os/guard';
import { canOps } from '@/lib/ops/os/permissions';
import { getVisitsDb, listSiteVisits, scheduleSiteVisit, updateSiteVisitStatus, type SiteVisitStatus } from '@/lib/ops/visits/store';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const closed = forbidUnlessPhase(4);
  if (closed) return closed;
  const auth = await requireOpsViewAccess(request);
  const denied = authResultToResponse(auth);
  if (denied) return denied;
  const visits = await listSiteVisits(await getVisitsDb());
  return NextResponse.json({ visits: releaseList(auth.admin, visits, 'deal') });
}

export async function POST(request: Request) {
  const closed = forbidUnlessPhase(4);
  if (closed) return closed;
  const auth = await requireOpsViewAccess(request);
  const denied = authResultToResponse(auth);
  if (denied) return denied;
  if (!canOps(auth.admin, 'remark') && !canOps(auth.admin, 'edit')) {
    return NextResponse.json({ error: 'You do not have permission to schedule a visit.' }, { status: 403 });
  }
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: 'Visit details are required.' }, { status: 400 });
  try {
    if (body.action === 'status') {
      const status = String(body.status || '') as SiteVisitStatus;
      const visit = await updateSiteVisitStatus(await getVisitsDb(), String(body.id || ''), status, auth.admin.id);
      if (!visit) return NextResponse.json({ error: 'Visit not found.' }, { status: 404 });
      return NextResponse.json({ visit });
    }
    const visit = await scheduleSiteVisit(await getVisitsDb(), {
      dealId: String(body.dealId || ''),
      scheduledAt: String(body.scheduledAt || ''),
      notes: String(body.notes || ''),
      assignedTo: String(body.assignedTo || auth.admin.id),
    }, auth.admin.id);
    return NextResponse.json({ visit }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to save the visit.' }, { status: 400 });
  }
}
