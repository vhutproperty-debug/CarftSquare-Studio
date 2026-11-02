import { NextResponse } from 'next/server';
import { logOpsActivity } from '@/lib/ops/activity/store';
import { actorLabel, authorizeProjectWrite, deniedProjectAuth } from '@/lib/ops/projects/api-auth';
import { slugify } from '@/lib/ops/projects/format';
import { projectError } from '@/lib/ops/projects/http';
import { parseResaleTable } from '@/lib/ops/projects/parse-resale-table';
import { getProjectsDatabase, getResaleProject, saveResaleProject, saveResaleUnit } from '@/lib/ops/projects/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(request: Request) {
  const auth = await authorizeProjectWrite(request);
  if (deniedProjectAuth(auth)) return auth.response;
  if (auth.actor.via === 'token') {
    return NextResponse.json({ error: 'Upload the spreadsheet from an admin session. The bearer token upserts one unit at a time.' }, { status: 403 });
  }
  try {
    const form = await request.formData();
    const file = form.get('file');
    if (!(file instanceof File)) return NextResponse.json({ error: 'Choose a .csv or .xlsx file.' }, { status: 400 });
    const defaultProject = String(form.get('project') || '');
    const units = parseResaleTable(file.name, Buffer.from(await file.arrayBuffer()), defaultProject);
    const db = await getProjectsDatabase();
    let created = 0;
    let updated = 0;
    for (const unit of units) {
      const project = await getResaleProject(db, unit.projectSlug);
      if (!project) {
        const name = defaultProject && slugify(defaultProject) === unit.projectSlug ? defaultProject : unit.projectSlug;
        await saveResaleProject(db, {
          slug: unit.projectSlug,
          name,
          patch: { name, developer: '', locality: '', towers: unit.tower ? [unit.tower] : [], notes: '', focus: 'resale' },
        }, actorLabel(auth.actor));
      }
      const saved = await saveResaleUnit(db, { slug: unit.slug, projectSlug: unit.projectSlug, patch: { ...unit } }, actorLabel(auth.actor));
      if (saved.created) created += 1;
      else updated += 1;
    }
    await logOpsActivity({
      action: 'upsert_resale_record',
      actorId: auth.actor.id,
      actorEmail: auth.actor.email,
      resource: 'ops_resale_units',
      details: { import: true, rows: units.length, created, updated },
      request,
    });
    return NextResponse.json({ ok: true, rows: units.length, created, updated });
  } catch (error) {
    return projectError(error, 'Unable to import resale units.');
  }
}
