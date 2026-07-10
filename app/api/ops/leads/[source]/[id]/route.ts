import { NextResponse } from 'next/server';
import { authResultToResponse } from '@/lib/auth/rbac/guard';
import { leadDetailResource, logOpsActivity } from '@/lib/ops/activity/store';
import { requireOpsViewAccess } from '@/lib/ops/auth';
import { getUnifiedLeadCallContext } from '@/lib/ops/calls/query';
import { fetchUnifiedLeadBySourceId } from '@/lib/ops/leads/query';
import { isOpsLeadSource } from '@/lib/ops/leads/types';

type RouteContext = {
  params: { source: string; id: string };
};

export async function GET(request: Request, context: RouteContext) {
  const auth = await requireOpsViewAccess(request);
  const denied = authResultToResponse(auth);
  if (denied) return denied;

  const { source, id } = context.params;
  if (!isOpsLeadSource(source)) {
    return NextResponse.json({ error: 'Invalid lead source.' }, { status: 400 });
  }
  if (!id?.trim()) {
    return NextResponse.json({ error: 'Lead id is required.' }, { status: 400 });
  }

  try {
    const lead = await fetchUnifiedLeadBySourceId(source, id);
    if (!lead) {
      return NextResponse.json({ error: 'Lead not found.' }, { status: 404 });
    }

    const callContext = await getUnifiedLeadCallContext(source, id);

    await logOpsActivity({
      action: 'view_lead_detail',
      actorId: auth.admin.id,
      actorEmail: auth.admin.email,
      resource: leadDetailResource(source, id),
      resourceId: id,
      details: { source },
      request,
    });

    return NextResponse.json({
      lead,
      callSummary: callContext.summary,
      callActivities: callContext.activities,
    });
  } catch (error) {
    console.error('[ops-leads] detail_failed', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Unable to load lead.' }, { status: 500 });
  }
}
