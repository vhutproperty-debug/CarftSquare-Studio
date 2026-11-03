import { NextResponse } from 'next/server';
import { authResultToResponse } from '@/lib/auth/rbac/guard';
import { requireOpsViewAccess } from '@/lib/ops/auth';
import { advanceInteriorProject, createInteriorProject, getInteriorDb, INTERIOR_STAGES, listInteriorProjects, type InteriorStage } from '@/lib/ops/interior/store';
import { forbidUnlessPhase, releaseList } from '@/lib/ops/os/guard';
import { canOps } from '@/lib/ops/os/permissions';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const closed = forbidUnlessPhase(6);
  if (closed) return closed;
  const auth = await requireOpsViewAccess(request);
  const denied = authResultToResponse(auth);
  if (denied) return denied;
  const projects = await listInteriorProjects(await getInteriorDb());
  return NextResponse.json({ projects: releaseList(auth.admin, projects, 'client'), stages: INTERIOR_STAGES });
}

export async function POST(request: Request) {
  const closed = forbidUnlessPhase(6);
  if (closed) return closed;
  const auth = await requireOpsViewAccess(request);
  const denied = authResultToResponse(auth);
  if (denied) return denied;
  if (!canOps(auth.admin, 'remark') && !canOps(auth.admin, 'fill_empty')) {
    return NextResponse.json({ error: 'You do not have permission to update interior projects.' }, { status: 403 });
  }
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: 'Interior project is required.' }, { status: 400 });
  const db = await getInteriorDb();
  try {
    if (body.action === 'stage') {
      const project = await advanceInteriorProject(db, String(body.id || ''), String(body.stage || '') as InteriorStage, auth.admin.id);
      if (!project) return NextResponse.json({ error: 'Project not found.' }, { status: 404 });
      return NextResponse.json({ project });
    }
    const project = await createInteriorProject(db, {
      title: String(body.title || ''),
      clientName: String(body.clientName || ''),
      phone: String(body.phone || ''),
      notes: String(body.notes || ''),
      assignedTo: String(body.assignedTo || auth.admin.id),
    }, auth.admin.id);
    return NextResponse.json({ project }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to save the interior project.' }, { status: 400 });
  }
}
