import { NextResponse } from 'next/server';
import { logOpsActivity } from '@/lib/ops/activity/store';
import { actorLabel, authorizeProjectRead, authorizeProjectWrite, deniedProjectAuth } from '@/lib/ops/projects/api-auth';
import { isListingType, isPriceBand, isResaleUnitStatus } from '@/lib/ops/projects/format';
import { projectError } from '@/lib/ops/projects/http';
import { filterResaleProjects, filterResaleUnits, resaleFilterOptions } from '@/lib/ops/projects/query';
import { presentResaleUnit } from '@/lib/ops/projects/redact';
import { releaseList } from '@/lib/ops/os/guard';
import { presentForActor } from '@/lib/ops/os/redact';
import {
  countUnitsByProject,
  getProjectsDatabase,
  listResaleProjects,
  listResaleUnits,
  saveResaleProject,
  saveResaleUnit,
} from '@/lib/ops/projects/store';
import type { ResaleListQuery } from '@/lib/ops/projects/types';
import { assertRecordType, parseResaleProjectWrite, parseResaleUnitWrite } from '@/lib/ops/projects/validate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

function queryFrom(url: URL): ResaleListQuery {
  const status = url.searchParams.get('status') || '';
  const priceBand = url.searchParams.get('priceBand') || '';
  const listingType = url.searchParams.get('listingType') || '';
  return {
    q: url.searchParams.get('q') || '',
    locality: url.searchParams.get('locality') || '',
    project: url.searchParams.get('project') || '',
    tower: url.searchParams.get('tower') || '',
    bhk: url.searchParams.get('bhk') || '',
    status: isResaleUnitStatus(status) ? status : '',
    priceBand: isPriceBand(priceBand) ? priceBand : '',
    floorBand: url.searchParams.get('floorBand') || '',
    listingType: isListingType(listingType) ? listingType : '',
  };
}

export async function GET(request: Request) {
  const auth = await authorizeProjectRead(request);
  if (deniedProjectAuth(auth)) return auth.response;
  try {
    const db = await getProjectsDatabase();
    const [projects, units] = await Promise.all([listResaleProjects(db), listResaleUnits(db)]);
    const query = queryFrom(new URL(request.url));
    const visibleProjects = filterResaleProjects(projects, query);
    const visibleUnits = releaseList(
      auth.actor,
      filterResaleUnits(units, query, projects, auth.canSeeSensitive).map((unit) => presentResaleUnit(unit, auth.canSeeSensitive)),
      'resale',
    );
    const counts = await countUnitsByProject(units);
    await logOpsActivity({
      action: 'view_resale_inventory',
      actorId: auth.actor.id,
      actorEmail: auth.actor.email,
      resource: 'ops_resale_projects',
      details: { projects: projects.length, units: units.length },
      request,
    });
    return NextResponse.json(presentForActor(auth.actor, {
      projects: visibleProjects.map((project) => ({ ...project, unitCount: counts[project.slug] || 0 })),
      units: visibleUnits,
      filterOptions: resaleFilterOptions(projects, units),
      canManage: auth.canManage,
      canSeeSensitive: auth.canSeeSensitive,
    }));
  } catch (error) {
    return projectError(error, 'Unable to load resale inventory.');
  }
}

async function upsert(request: Request) {
  const auth = await authorizeProjectWrite(request);
  if (deniedProjectAuth(auth)) return auth.response;
  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'Project payload must be an object.' }, { status: 400 });
    }
    const recordType = assertRecordType(body as Record<string, unknown>);
    const db = await getProjectsDatabase();
    if (recordType === 'project') {
      const write = parseResaleProjectWrite(body as Record<string, unknown>);
      const result = await saveResaleProject(db, write, actorLabel(auth.actor));
      await logOpsActivity({
        action: 'upsert_resale_record',
        actorId: auth.actor.id,
        actorEmail: auth.actor.email,
        resource: 'ops_resale_projects',
        resourceId: result.project.id,
        details: { recordType, slug: result.project.slug, created: result.created, via: auth.actor.via },
        request,
      });
      return NextResponse.json({ ok: true, recordType, created: result.created, project: result.project });
    }
    const write = parseResaleUnitWrite(body as Record<string, unknown>);
    const result = await saveResaleUnit(db, write, actorLabel(auth.actor));
    await logOpsActivity({
      action: 'upsert_resale_record',
      actorId: auth.actor.id,
      actorEmail: auth.actor.email,
      resource: 'ops_resale_units',
      resourceId: result.unit.id,
      details: { recordType, slug: result.unit.slug, projectSlug: result.unit.projectSlug, created: result.created, via: auth.actor.via },
      request,
    });
    return NextResponse.json({
      ok: true,
      recordType,
      created: result.created,
      unit: presentResaleUnit(result.unit, true),
    });
  } catch (error) {
    return projectError(error, 'Unable to save the resale record.');
  }
}

export async function POST(request: Request) {
  return upsert(request);
}

export async function PATCH(request: Request) {
  return upsert(request);
}
