import { NextResponse } from 'next/server';
import { authResultToResponse } from '@/lib/auth/rbac/guard';
import { logOpsActivity } from '@/lib/ops/activity/store';
import { requireOpsEditAccess, requireOpsViewAccess } from '@/lib/ops/auth';
import { createMatchActivity } from '@/lib/ops/matching/activity-store';
import { getMatchDetail } from '@/lib/ops/matching/query';
import { patchMatchRecordSchema } from '@/lib/ops/matching/schemas';
import { MATCH_STATUS_LABELS } from '@/lib/ops/matching/statuses';
import { getDatabase, getMatchRecord, updateMatchRecord } from '@/lib/ops/matching/store';
import { listOpsTeamMembers } from '@/lib/ops/calls/query';

type RouteContext = { params: { id: string } };

const STATUS_ACTIVITY: Partial<Record<string, 'SHORTLISTED' | 'REJECTED' | 'OWNER_CONTACTED' | 'CLIENT_SHARED' | 'SITE_VISIT_SCHEDULED' | 'ACCEPTED' | 'CONVERTED_TO_DEAL'>> = {
  SHORTLISTED: 'SHORTLISTED',
  REJECTED: 'REJECTED',
  OWNER_CONTACTED: 'OWNER_CONTACTED',
  CLIENT_SHARED: 'CLIENT_SHARED',
  SITE_VISIT_SCHEDULED: 'SITE_VISIT_SCHEDULED',
  ACCEPTED: 'ACCEPTED',
  CONVERTED_TO_DEAL: 'CONVERTED_TO_DEAL',
};

export async function GET(request: Request, context: RouteContext) {
  const auth = await requireOpsViewAccess(request);
  const denied = authResultToResponse(auth);
  if (denied) return denied;

  const { id } = context.params;
  if (!id?.trim()) {
    return NextResponse.json({ error: 'Invalid match record.' }, { status: 400 });
  }

  try {
    const detail = await getMatchDetail(id, auth.admin);
    if (!detail) {
      return NextResponse.json({ error: 'Match not found.' }, { status: 404 });
    }

    await logOpsActivity({
      action: 'view_match_record',
      actorId: auth.admin.id,
      actorEmail: auth.admin.email,
      resource: 'ops_match_record',
      resourceId: id,
      request,
    });

    return NextResponse.json(detail);
  } catch (error) {
    console.error('[ops-matching] detail_failed', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Unable to load match.' }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireOpsEditAccess(request);
  const denied = authResultToResponse(auth);
  if (denied) return denied;

  const { id } = context.params;
  if (!id?.trim()) {
    return NextResponse.json({ error: 'Invalid match record.' }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const parsed = patchMatchRecordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const db = await getDatabase();
    const existing = await getMatchRecord(db, id);
    if (!existing) {
      return NextResponse.json({ error: 'Match not found.' }, { status: 404 });
    }

    const team = await listOpsTeamMembers(db);
    const teamMap = new Map(team.map((m) => [m.id, m]));
    const patch = parsed.data;
    const updatePayload: Parameters<typeof updateMatchRecord>[2] = {
      updatedBy: auth.admin.id,
    };

    if (patch.status) updatePayload.status = patch.status;
    if (patch.notes !== undefined) updatePayload.notes = patch.notes;
    if (patch.siteVisitAt !== undefined) updatePayload.siteVisitAt = patch.siteVisitAt || null;

    if (patch.broker !== undefined) {
      if (patch.broker === '') {
        updatePayload.broker = null;
        updatePayload.brokerName = null;
      } else {
        updatePayload.broker = patch.broker;
        updatePayload.brokerName = teamMap.get(patch.broker)?.name || patch.broker;
      }
    }

    const match = await updateMatchRecord(db, id, updatePayload);
    if (!match) {
      return NextResponse.json({ error: 'Unable to update match.' }, { status: 500 });
    }

    if (patch.status && patch.status !== existing.status) {
      await createMatchActivity(db, {
        matchId: id,
        type: 'STATUS_CHANGED',
        message: `Status changed to ${MATCH_STATUS_LABELS[patch.status]}`,
        meta: { from: existing.status, to: patch.status },
        actorId: auth.admin.id,
        actorEmail: auth.admin.email,
        actorName: auth.admin.name,
      });

      const activityType = STATUS_ACTIVITY[patch.status];
      if (activityType && activityType !== 'STATUS_CHANGED') {
        await createMatchActivity(db, {
          matchId: id,
          type: activityType,
          message: MATCH_STATUS_LABELS[patch.status],
          actorId: auth.admin.id,
          actorEmail: auth.admin.email,
          actorName: auth.admin.name,
        });
      }
    }

    if (patch.broker !== undefined && patch.broker !== (existing.broker || '')) {
      await createMatchActivity(db, {
        matchId: id,
        type: 'ASSIGNED',
        message: patch.broker
          ? `Assigned to ${updatePayload.brokerName || patch.broker}`
          : 'Assignment cleared',
        actorId: auth.admin.id,
        actorEmail: auth.admin.email,
        actorName: auth.admin.name,
      });
    }

    if (patch.notes !== undefined && patch.notes !== existing.notes) {
      await createMatchActivity(db, {
        matchId: id,
        type: 'NOTE_ADDED',
        message: 'Broker notes updated',
        actorId: auth.admin.id,
        actorEmail: auth.admin.email,
        actorName: auth.admin.name,
      });
    }

    await logOpsActivity({
      action: 'update_match_record',
      actorId: auth.admin.id,
      actorEmail: auth.admin.email,
      resource: 'ops_match_record',
      resourceId: id,
      details: { fields: Object.keys(patch) },
      request,
    });

    const activities = await import('@/lib/ops/matching/activity-store').then((m) =>
      m.listMatchActivities(db, id),
    );

    return NextResponse.json({ match, activities });
  } catch (error) {
    console.error('[ops-matching] patch_failed', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Unable to update match.' }, { status: 500 });
  }
}
