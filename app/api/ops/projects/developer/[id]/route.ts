import { NextResponse } from 'next/server';
import { logOpsActivity } from '@/lib/ops/activity/store';
import { actorLabel, authorizeProjectRead, authorizeProjectWrite, deniedProjectAuth } from '@/lib/ops/projects/api-auth';
import { projectError } from '@/lib/ops/projects/http';
import {
  deleteDeveloperProject,
  getDeveloperProject,
  getProjectsDatabase,
  saveDeveloperProject,
} from '@/lib/ops/projects/store';
import { parseDeveloperWrite } from '@/lib/ops/projects/validate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const auth = await authorizeProjectRead(request);
  if (deniedProjectAuth(auth)) return auth.response;
  try {
    const project = await getDeveloperProject(await getProjectsDatabase(), params.id);
    if (!project) return NextResponse.json({ error: 'Project not found.' }, { status: 404 });
    await logOpsActivity({
      action: 'view_developer_project',
      actorId: auth.actor.id,
      actorEmail: auth.actor.email,
      resource: 'ops_developer_projects',
      resourceId: project.id,
      details: { slug: project.slug },
      request,
    });
    return NextResponse.json({ project, canManage: auth.canManage });
  } catch (error) {
    return projectError(error, 'Unable to load the project.');
  }
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const auth = await authorizeProjectWrite(request);
  if (deniedProjectAuth(auth)) return auth.response;
  try {
    const db = await getProjectsDatabase();
    const existing = await getDeveloperProject(db, params.id);
    if (!existing) return NextResponse.json({ error: 'Project not found.' }, { status: 404 });
    const body = await request.json().catch(() => null);
    const write = parseDeveloperWrite({ ...(body && typeof body === 'object' ? body : {}), slug: existing.slug, name: (body as { name?: string } | null)?.name || existing.name });
    if (write.slug !== existing.slug) {
      return NextResponse.json({ error: 'Slug cannot be changed. Upsert a new slug instead.' }, { status: 400 });
    }
    const result = await saveDeveloperProject(db, { ...write, name: write.name || existing.name }, actorLabel(auth.actor));
    await logOpsActivity({
      action: 'upsert_developer_project',
      actorId: auth.actor.id,
      actorEmail: auth.actor.email,
      resource: 'ops_developer_projects',
      resourceId: result.project.id,
      details: { slug: result.project.slug, created: false, via: auth.actor.via },
      request,
    });
    return NextResponse.json({ ok: true, created: false, project: result.project });
  } catch (error) {
    return projectError(error, 'Unable to save the developer project.');
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const auth = await authorizeProjectWrite(request);
  if (deniedProjectAuth(auth)) return auth.response;
  try {
    const db = await getProjectsDatabase();
    const existing = await getDeveloperProject(db, params.id);
    if (!existing) return NextResponse.json({ error: 'Project not found.' }, { status: 404 });
    await deleteDeveloperProject(db, existing.slug);
    await logOpsActivity({
      action: 'delete_developer_project',
      actorId: auth.actor.id,
      actorEmail: auth.actor.email,
      resource: 'ops_developer_projects',
      resourceId: existing.id,
      details: { slug: existing.slug },
      request,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return projectError(error, 'Unable to delete the project.');
  }
}
