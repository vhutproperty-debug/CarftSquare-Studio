import { NextResponse } from 'next/server';
import { logOpsActivity } from '@/lib/ops/activity/store';
import { actorLabel, authorizeProjectRead, authorizeProjectWrite, deniedProjectAuth } from '@/lib/ops/projects/api-auth';
import { projectError } from '@/lib/ops/projects/http';
import { presentResaleUnit } from '@/lib/ops/projects/redact';
import { releaseList } from '@/lib/ops/os/guard';
import { recordVisibleTo } from '@/lib/ops/os/permissions';
import { presentForActor } from '@/lib/ops/os/redact';
import {
  deleteResaleProject,
  deleteResaleUnit,
  getProjectsDatabase,
  getResaleProject,
  getResaleUnit,
  listResaleUnits,
  saveResaleProject,
  saveResaleUnit,
} from '@/lib/ops/projects/store';
import { parseResaleProjectWrite, parseResaleUnitWrite } from '@/lib/ops/projects/validate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

function recordTypeOf(request: Request): 'project' | 'unit' | '' {
  const value = new URL(request.url).searchParams.get('recordType') || '';
  if (value === 'project' || value === 'unit') return value;
  return '';
}

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const auth = await authorizeProjectRead(request);
  if (deniedProjectAuth(auth)) return auth.response;
  try {
    const db = await getProjectsDatabase();
    const kind = recordTypeOf(request);
    if (kind !== 'unit') {
      const project = await getResaleProject(db, params.id);
      if (project) {
        const units = releaseList(
          auth.actor,
          (await listResaleUnits(db))
            .filter((unit) => unit.projectSlug === project.slug)
            .map((unit) => presentResaleUnit(unit, auth.canSeeSensitive)),
          'resale',
        );
        await logOpsActivity({
          action: 'view_resale_record',
          actorId: auth.actor.id,
          actorEmail: auth.actor.email,
          resource: 'ops_resale_projects',
          resourceId: project.id,
          details: { slug: project.slug, recordType: 'project' },
          request,
        });
        return NextResponse.json(presentForActor(auth.actor, { recordType: 'project', project, units, canManage: auth.canManage, canSeeSensitive: auth.canSeeSensitive }));
      }
      if (kind === 'project') return NextResponse.json({ error: 'Project not found.' }, { status: 404 });
    }
    const unit = await getResaleUnit(db, params.id);
    if (!unit || !recordVisibleTo(auth.actor, unit, 'resale')) {
      return NextResponse.json({ error: 'Record not found.' }, { status: 404 });
    }
    await logOpsActivity({
      action: 'view_resale_record',
      actorId: auth.actor.id,
      actorEmail: auth.actor.email,
      resource: 'ops_resale_units',
      resourceId: unit.id,
      details: { slug: unit.slug, recordType: 'unit' },
      request,
    });
    return NextResponse.json(presentForActor(auth.actor, {
      recordType: 'unit',
      unit: presentResaleUnit(unit, auth.canSeeSensitive),
      canManage: auth.canManage,
      canSeeSensitive: auth.canSeeSensitive,
    }));
  } catch (error) {
    return projectError(error, 'Unable to load the resale record.');
  }
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const auth = await authorizeProjectWrite(request);
  if (deniedProjectAuth(auth)) return auth.response;
  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'Project payload must be an object.' }, { status: 400 });
    }
    const db = await getProjectsDatabase();
    const kind = recordTypeOf(request) || ((body as { recordType?: string }).recordType === 'unit' ? 'unit' : 'project');
    if (kind === 'unit') {
      const existing = await getResaleUnit(db, params.id);
      if (!existing) return NextResponse.json({ error: 'Unit not found.' }, { status: 404 });
      const write = parseResaleUnitWrite({ ...(body as Record<string, unknown>), slug: existing.slug, projectSlug: (body as { projectSlug?: string }).projectSlug || existing.projectSlug });
      if (write.slug !== existing.slug) {
        return NextResponse.json({ error: 'Slug cannot be changed.' }, { status: 400 });
      }
      const result = await saveResaleUnit(db, write, actorLabel(auth.actor));
      await logOpsActivity({
        action: 'upsert_resale_record',
        actorId: auth.actor.id,
        actorEmail: auth.actor.email,
        resource: 'ops_resale_units',
        resourceId: result.unit.id,
        details: { slug: result.unit.slug, recordType: 'unit', via: auth.actor.via },
        request,
      });
      return NextResponse.json({ ok: true, recordType: 'unit', unit: presentResaleUnit(result.unit, true) });
    }
    const existing = await getResaleProject(db, params.id);
    if (!existing) return NextResponse.json({ error: 'Project not found.' }, { status: 404 });
    const write = parseResaleProjectWrite({ ...(body as Record<string, unknown>), slug: existing.slug, name: (body as { name?: string }).name || existing.name });
    if (write.slug !== existing.slug) {
      return NextResponse.json({ error: 'Slug cannot be changed.' }, { status: 400 });
    }
    const result = await saveResaleProject(db, { ...write, name: write.name || existing.name }, actorLabel(auth.actor));
    await logOpsActivity({
      action: 'upsert_resale_record',
      actorId: auth.actor.id,
      actorEmail: auth.actor.email,
      resource: 'ops_resale_projects',
      resourceId: result.project.id,
      details: { slug: result.project.slug, recordType: 'project', via: auth.actor.via },
      request,
    });
    return NextResponse.json({ ok: true, recordType: 'project', project: result.project });
  } catch (error) {
    return projectError(error, 'Unable to save the resale record.');
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const auth = await authorizeProjectWrite(request);
  if (deniedProjectAuth(auth)) return auth.response;
  try {
    const db = await getProjectsDatabase();
    const kind = recordTypeOf(request);
    if (kind === 'unit') {
      const existing = await getResaleUnit(db, params.id);
      if (!existing) return NextResponse.json({ error: 'Unit not found.' }, { status: 404 });
      await deleteResaleUnit(db, existing.slug);
      await logOpsActivity({
        action: 'delete_resale_record',
        actorId: auth.actor.id,
        actorEmail: auth.actor.email,
        resource: 'ops_resale_units',
        resourceId: existing.id,
        details: { slug: existing.slug, recordType: 'unit' },
        request,
      });
      return NextResponse.json({ ok: true });
    }
    const existing = await getResaleProject(db, params.id);
    if (!existing) return NextResponse.json({ error: 'Project not found.' }, { status: 404 });
    await deleteResaleProject(db, existing.slug);
    await logOpsActivity({
      action: 'delete_resale_record',
      actorId: auth.actor.id,
      actorEmail: auth.actor.email,
      resource: 'ops_resale_projects',
      resourceId: existing.id,
      details: { slug: existing.slug, recordType: 'project' },
      request,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return projectError(error, 'Unable to delete the resale record.');
  }
}
