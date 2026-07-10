import { NextResponse } from 'next/server';
import { authResultToResponse } from '@/lib/auth/rbac/guard';
import {
  getCallTargetSummary,
  getDatabase,
  listCallActivitiesForTarget,
} from '@/lib/ops/calls/activity-store';
import {
  getProspectById,
  updateProspect,
} from '@/lib/ops/calls/prospect-store';
import { updateProspectSchema } from '@/lib/ops/calls/schemas';
import { canViewAllCallRecords } from '@/lib/ops/calls/query';
import { requireOpsEditAccess, requireOpsViewAccess } from '@/lib/ops/auth';

type RouteContext = {
  params: { id: string };
};

function canAccessProspect(
  prospect: { assignedTo?: string },
  adminId: string,
  viewAll: boolean,
): boolean {
  if (viewAll) return true;
  if (!prospect.assignedTo || prospect.assignedTo === adminId) return true;
  return false;
}

export async function GET(request: Request, context: RouteContext) {
  const auth = await requireOpsViewAccess(request);
  const denied = authResultToResponse(auth);
  if (denied) return denied;

  const { id } = context.params;
  if (!id?.trim()) {
    return NextResponse.json({ error: 'Prospect id is required.' }, { status: 400 });
  }

  try {
    const db = await getDatabase();
    const prospect = await getProspectById(db, id);
    if (!prospect) {
      return NextResponse.json({ error: 'Prospect not found.' }, { status: 404 });
    }

    if (!canAccessProspect(prospect, auth.admin.id, canViewAllCallRecords(auth.admin))) {
      return NextResponse.json({ error: 'You do not have access to this prospect.' }, { status: 403 });
    }

    const [activities, summary] = await Promise.all([
      listCallActivitiesForTarget(db, 'ops_prospect', id, undefined, 100),
      getCallTargetSummary(db, 'ops_prospect', id),
    ]);

    return NextResponse.json({ prospect, activities, summary });
  } catch (error) {
    console.error('[ops-prospects] detail_failed', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Unable to load prospect.' }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireOpsEditAccess(request);
  const denied = authResultToResponse(auth);
  if (denied) return denied;

  const { id } = context.params;
  if (!id?.trim()) {
    return NextResponse.json({ error: 'Prospect id is required.' }, { status: 400 });
  }

  try {
    const body = await request.json();
    const parsed = updateProspectSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const db = await getDatabase();
    const existing = await getProspectById(db, id);
    if (!existing) {
      return NextResponse.json({ error: 'Prospect not found.' }, { status: 404 });
    }

    const viewAll = canViewAllCallRecords(auth.admin);
    if (!canAccessProspect(existing, auth.admin.id, viewAll)) {
      return NextResponse.json({ error: 'You do not have access to this prospect.' }, { status: 403 });
    }

    const data = parsed.data;
    const patch = {
      ...data,
      assignedTo: data.assignedTo === '' ? undefined : data.assignedTo,
    };

    if (patch.assignedTo && !viewAll && patch.assignedTo !== auth.admin.id) {
      return NextResponse.json({ error: 'Only owners can reassign prospects to other team members.' }, { status: 403 });
    }

    const prospect = await updateProspect(db, id, patch);
    return NextResponse.json({ prospect });
  } catch (error) {
    console.error('[ops-prospects] update_failed', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Unable to update prospect.' }, { status: 500 });
  }
}
