import { NextResponse } from 'next/server';
import { authResultToResponse } from '@/lib/auth/rbac/guard';
import { isSuperAdmin } from '@/lib/auth/rbac/roles';
import {
  createCallActivity,
  getCallTargetSummary,
  getDatabase,
  listCallActivitiesForTarget,
} from '@/lib/ops/calls/activity-store';
import {
  createCallActivitySchema,
  listCallActivitiesQuerySchema,
  normalizeProspectPhone,
} from '@/lib/ops/calls/schemas';
import { syncProspectFromCallActivity } from '@/lib/ops/calls/prospect-store';
import { requiresFollowUp } from '@/lib/ops/calls/statuses';
import type { CallActivityStatus } from '@/lib/ops/calls/statuses';
import { requireOpsEditAccess, requireOpsViewAccess } from '@/lib/ops/auth';
import { fetchUnifiedLeadBySourceId } from '@/lib/ops/leads/query';
import { isOpsLeadSource } from '@/lib/ops/leads/types';
import { getProspectById } from '@/lib/ops/calls/prospect-store';

export async function GET(request: Request) {
  const auth = await requireOpsViewAccess(request);
  const denied = authResultToResponse(auth);
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  const parsed = listCallActivitiesQuerySchema.safeParse({
    targetType: searchParams.get('targetType'),
    targetSource: searchParams.get('targetSource') || undefined,
    targetId: searchParams.get('targetId'),
  });

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const db = await getDatabase();
    const { targetType, targetSource, targetId } = parsed.data;
    const [activities, summary] = await Promise.all([
      listCallActivitiesForTarget(db, targetType, targetId, targetSource, 100),
      getCallTargetSummary(db, targetType, targetId, targetSource),
    ]);
    return NextResponse.json({ activities, summary });
  } catch (error) {
    console.error('[ops-calls] list_failed', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Unable to load call history.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireOpsEditAccess(request);
  const denied = authResultToResponse(auth);
  if (denied) return denied;

  try {
    const body = await request.json();
    const parsed = createCallActivitySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const data = parsed.data;
    const db = await getDatabase();
    const status = data.status as CallActivityStatus;

    if (requiresFollowUp(status) && !data.nextFollowUpAt) {
      return NextResponse.json({ error: 'Follow-up date and time are required for this result.' }, { status: 400 });
    }

    if (data.targetType === 'unified_lead') {
      if (!data.targetSource || !isOpsLeadSource(data.targetSource)) {
        return NextResponse.json({ error: 'Invalid lead source.' }, { status: 400 });
      }
      const lead = await fetchUnifiedLeadBySourceId(data.targetSource, data.targetId, db);
      if (!lead) {
        return NextResponse.json({ error: 'Lead not found.' }, { status: 404 });
      }
    } else {
      const prospect = await getProspectById(db, data.targetId);
      if (!prospect) {
        return NextResponse.json({ error: 'Prospect not found.' }, { status: 404 });
      }
    }

    const currentSummary = await getCallTargetSummary(
      db,
      data.targetType,
      data.targetId,
      data.targetSource,
    );

    if (currentSummary.doNotCall && status !== 'DO_NOT_CALL') {
      const canOverride = isSuperAdmin(auth.admin) && data.adminOverrideDoNotCall === true;
      if (!canOverride) {
        return NextResponse.json(
          { error: 'This record is marked Do Not Call. Owner/admin override is required.' },
          { status: 403 },
        );
      }
    }

    const activity = await createCallActivity(db, {
      targetType: data.targetType,
      targetSource: data.targetSource,
      targetId: data.targetId,
      phone: normalizeProspectPhone(data.phone),
      status,
      note: data.note,
      nextFollowUpAt: data.nextFollowUpAt,
      calledBy: auth.admin.id,
      calledByEmail: auth.admin.email,
      calledByName: auth.admin.name,
    });

    if (data.targetType === 'ops_prospect') {
      await syncProspectFromCallActivity(
        db,
        data.targetId,
        status,
        data.nextFollowUpAt,
      );
    }

    const summary = await getCallTargetSummary(
      db,
      data.targetType,
      data.targetId,
      data.targetSource,
    );

    return NextResponse.json({ activity, summary }, { status: 201 });
  } catch (error) {
    console.error('[ops-calls] create_failed', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Unable to save call result.' }, { status: 500 });
  }
}
