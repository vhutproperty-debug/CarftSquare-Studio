import { NextResponse } from 'next/server';
import { authResultToResponse } from '@/lib/auth/rbac/guard';
import { logOpsActivity } from '@/lib/ops/activity/store';
import { requireOpsEditAccess } from '@/lib/ops/auth';
import {
  deleteProjectAlias,
  updateProjectAlias,
} from '@/lib/ops/brokers/normalize/project-aliases';
import { projectAliasPatchSchema } from '@/lib/ops/brokers/schemas';
import { getDatabase } from '@/lib/ops/brokers/store';

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  const auth = await requireOpsEditAccess(request);
  const denied = authResultToResponse(auth);
  if (denied) return denied;
  if (!auth.ok) return denied!;

  const body = await request.json().catch(() => null);
  const parsed = projectAliasPatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const db = await getDatabase();
    const alias = await updateProjectAlias(db, params.id, parsed.data);
    if (!alias) return NextResponse.json({ error: 'Alias not found.' }, { status: 404 });
    await logOpsActivity({
      action: 'broker_project_alias_mutated',
      actorId: auth.admin.id,
      actorEmail: auth.admin.email,
      resource: 'ops_project_aliases',
      resourceId: alias.id,
      details: { op: 'update', canonicalProject: alias.canonicalProject },
      request,
    });
    return NextResponse.json({ alias });
  } catch (error) {
    console.error('[ops-brokers] project_patch_failed', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Unable to update project alias.' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } },
) {
  const auth = await requireOpsEditAccess(request);
  const denied = authResultToResponse(auth);
  if (denied) return denied;
  if (!auth.ok) return denied!;

  try {
    const db = await getDatabase();
    const ok = await deleteProjectAlias(db, params.id);
    if (!ok) return NextResponse.json({ error: 'Alias not found.' }, { status: 404 });
    await logOpsActivity({
      action: 'broker_project_alias_mutated',
      actorId: auth.admin.id,
      actorEmail: auth.admin.email,
      resource: 'ops_project_aliases',
      resourceId: params.id,
      details: { op: 'delete' },
      request,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[ops-brokers] project_delete_failed', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Unable to delete project alias.' }, { status: 500 });
  }
}
