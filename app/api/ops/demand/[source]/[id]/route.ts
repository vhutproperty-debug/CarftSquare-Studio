import { NextResponse } from 'next/server';
import { authResultToResponse } from '@/lib/auth/rbac/guard';
import { logOpsActivity, leadDetailResource } from '@/lib/ops/activity/store';
import { requireOpsEditAccess, requireOpsViewAccess } from '@/lib/ops/auth';
import { createDemandActivity } from '@/lib/ops/demand/activity-store';
import { DEMAND_STATUS_LABELS } from '@/lib/ops/demand/statuses';
import { getDemandDetail, mergeQualification } from '@/lib/ops/demand/query';
import { patchDemandRecordSchema } from '@/lib/ops/demand/schemas';
import { computeQualificationPercent } from '@/lib/ops/demand/qualification';
import { updateDemandRecord } from '@/lib/ops/demand/store';
import { getDatabase } from '@/lib/ops/demand/store';
import { isOpsLeadSource } from '@/lib/ops/leads/types';
import { listOpsTeamMembers } from '@/lib/ops/calls/query';

type RouteContext = { params: { source: string; id: string } };

export async function GET(request: Request, context: RouteContext) {
  const auth = await requireOpsViewAccess(request);
  const denied = authResultToResponse(auth);
  if (denied) return denied;

  const { source, id } = context.params;
  if (!isOpsLeadSource(source) || !id?.trim()) {
    return NextResponse.json({ error: 'Invalid demand record.' }, { status: 400 });
  }

  try {
    const detail = await getDemandDetail(source, id, auth.admin);
    if (!detail) {
      return NextResponse.json({ error: 'Enquiry not found.' }, { status: 404 });
    }

    await logOpsActivity({
      action: 'view_lead_detail',
      actorId: auth.admin.id,
      actorEmail: auth.admin.email,
      resource: leadDetailResource(source, id),
      resourceId: id,
      request,
    });

    return NextResponse.json(detail);
  } catch (error) {
    console.error('[ops-demand] detail_failed', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Unable to load enquiry.' }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireOpsEditAccess(request);
  const denied = authResultToResponse(auth);
  if (denied) return denied;

  const { source, id } = context.params;
  if (!isOpsLeadSource(source) || !id?.trim()) {
    return NextResponse.json({ error: 'Invalid demand record.' }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const parsed = patchDemandRecordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const db = await getDatabase();
    const detail = await getDemandDetail(source, id, auth.admin, db);
    if (!detail) {
      return NextResponse.json({ error: 'Enquiry not found.' }, { status: 404 });
    }

    const team = await listOpsTeamMembers(db);
    const teamMap = new Map(team.map((m) => [m.id, m]));
    const patch = parsed.data;
    const updatePayload: Parameters<typeof updateDemandRecord>[3] = {
      updatedBy: auth.admin.id,
    };

    if (patch.status) {
      updatePayload.status = patch.status;
      if (patch.status === 'CONTACTED' && !detail.demand.firstContactedAt) {
        updatePayload.firstContactedAt = new Date().toISOString();
      }
      if (patch.status === 'READY_FOR_MATCHING') {
        updatePayload.readyForMatchingAt = new Date().toISOString();
      }
    }
    if (patch.priority) updatePayload.priority = patch.priority;
    if (patch.internalNotes !== undefined) updatePayload.internalNotes = patch.internalNotes;
    if (patch.lostReason !== undefined) updatePayload.lostReason = patch.lostReason;

    if (patch.assignedTo !== undefined) {
      if (patch.assignedTo === '') {
        updatePayload.assignedTo = null;
        updatePayload.assignedToName = null;
      } else {
        updatePayload.assignedTo = patch.assignedTo;
        updatePayload.assignedToName = teamMap.get(patch.assignedTo)?.name || patch.assignedTo;
      }
    }

    if (patch.qualification) {
      const merged = mergeQualification(detail.demand.qualification, patch.qualification);
      updatePayload.qualification = merged;
      updatePayload.qualificationPercent = computeQualificationPercent(merged);
    }

    if (patch.nextFollowUpAt !== undefined) {
      updatePayload.nextFollowUpAt = patch.nextFollowUpAt || null;
    }

    if (patch.followUpCompleted) {
      updatePayload.followUpCompletedAt = new Date().toISOString();
      updatePayload.nextFollowUpAt = null;
    }

    const demand = await updateDemandRecord(db, source, id, updatePayload);
    if (!demand) {
      return NextResponse.json({ error: 'Unable to update record.' }, { status: 500 });
    }

    if (patch.status && patch.status !== detail.demand.status) {
      await createDemandActivity(db, {
        source,
        sourceId: id,
        type: 'STATUS_CHANGED',
        message: `Status changed to ${DEMAND_STATUS_LABELS[patch.status]}`,
        meta: { from: detail.demand.status, to: patch.status },
        actorId: auth.admin.id,
        actorEmail: auth.admin.email,
        actorName: auth.admin.name,
      });
    }

    if (patch.assignedTo !== undefined && patch.assignedTo !== (detail.demand.assignedTo || '')) {
      await createDemandActivity(db, {
        source,
        sourceId: id,
        type: 'ASSIGNED',
        message: patch.assignedTo
          ? `Assigned to ${updatePayload.assignedToName || patch.assignedTo}`
          : 'Assignment cleared',
        actorId: auth.admin.id,
        actorEmail: auth.admin.email,
        actorName: auth.admin.name,
      });
    }

    if (patch.qualification) {
      await createDemandActivity(db, {
        source,
        sourceId: id,
        type: 'QUALIFICATION_UPDATED',
        message: `Qualification updated (${demand.qualificationPercent}% complete)`,
        actorId: auth.admin.id,
        actorEmail: auth.admin.email,
        actorName: auth.admin.name,
      });
    }

    if (patch.internalNotes !== undefined && patch.internalNotes !== detail.demand.internalNotes) {
      await createDemandActivity(db, {
        source,
        sourceId: id,
        type: 'NOTE_ADDED',
        message: 'Internal note updated',
        actorId: auth.admin.id,
        actorEmail: auth.admin.email,
        actorName: auth.admin.name,
      });
    }

    if (patch.nextFollowUpAt) {
      await createDemandActivity(db, {
        source,
        sourceId: id,
        type: 'FOLLOW_UP_SCHEDULED',
        message: `Follow-up scheduled for ${new Date(patch.nextFollowUpAt).toLocaleString('en-IN')}`,
        meta: { nextFollowUpAt: patch.nextFollowUpAt },
        actorId: auth.admin.id,
        actorEmail: auth.admin.email,
        actorName: auth.admin.name,
      });
    }

    if (patch.followUpCompleted) {
      await createDemandActivity(db, {
        source,
        sourceId: id,
        type: 'FOLLOW_UP_COMPLETED',
        message: 'Follow-up marked completed',
        actorId: auth.admin.id,
        actorEmail: auth.admin.email,
        actorName: auth.admin.name,
      });
    }

    await logOpsActivity({
      action: 'update_demand_record',
      actorId: auth.admin.id,
      actorEmail: auth.admin.email,
      resource: leadDetailResource(source, id),
      resourceId: id,
      details: { fields: Object.keys(patch) },
      request,
    });

    const activities = await import('@/lib/ops/demand/activity-store').then((m) =>
      m.listDemandActivities(db, source, id),
    );

    return NextResponse.json({ demand, activities });
  } catch (error) {
    console.error('[ops-demand] patch_failed', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Unable to update enquiry.' }, { status: 500 });
  }
}
