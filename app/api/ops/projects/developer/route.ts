import { NextResponse } from 'next/server';
import { logOpsActivity } from '@/lib/ops/activity/store';
import { actorLabel, authorizeProjectRead, authorizeProjectWrite, deniedProjectAuth } from '@/lib/ops/projects/api-auth';
import { isDeveloperStatus, isPriceBand } from '@/lib/ops/projects/format';
import { projectError } from '@/lib/ops/projects/http';
import { developerFilterOptions, filterDeveloperProjects } from '@/lib/ops/projects/query';
import { getProjectsDatabase, listDeveloperProjects, saveDeveloperProject } from '@/lib/ops/projects/store';
import type { DeveloperListQuery } from '@/lib/ops/projects/types';
import { parseDeveloperWrite } from '@/lib/ops/projects/validate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

function queryFrom(url: URL): DeveloperListQuery {
  const status = url.searchParams.get('status') || '';
  const priceBand = url.searchParams.get('priceBand') || '';
  return {
    q: url.searchParams.get('q') || '',
    locality: url.searchParams.get('locality') || '',
    developer: url.searchParams.get('developer') || '',
    status: isDeveloperStatus(status) ? status : '',
    priceBand: isPriceBand(priceBand) ? priceBand : '',
    bhk: url.searchParams.get('bhk') || '',
  };
}

export async function GET(request: Request) {
  const auth = await authorizeProjectRead(request);
  if (deniedProjectAuth(auth)) return auth.response;
  try {
    const projects = await listDeveloperProjects(await getProjectsDatabase());
    const url = new URL(request.url);
    const items = filterDeveloperProjects(projects, queryFrom(url));
    await logOpsActivity({
      action: 'view_developer_projects',
      actorId: auth.actor.id,
      actorEmail: auth.actor.email,
      resource: 'ops_developer_projects',
      details: { total: projects.length, shown: items.length },
      request,
    });
    return NextResponse.json({
      items,
      total: items.length,
      filterOptions: developerFilterOptions(projects),
      canManage: auth.canManage,
    });
  } catch (error) {
    return projectError(error, 'Unable to load developer projects.');
  }
}

async function upsert(request: Request) {
  const auth = await authorizeProjectWrite(request);
  if (deniedProjectAuth(auth)) return auth.response;
  try {
    const body = await request.json().catch(() => null);
    const write = parseDeveloperWrite(body);
    const result = await saveDeveloperProject(await getProjectsDatabase(), write, actorLabel(auth.actor));
    await logOpsActivity({
      action: 'upsert_developer_project',
      actorId: auth.actor.id,
      actorEmail: auth.actor.email,
      resource: 'ops_developer_projects',
      resourceId: result.project.id,
      details: { slug: result.project.slug, created: result.created, via: auth.actor.via },
      request,
    });
    return NextResponse.json({ ok: true, created: result.created, project: result.project });
  } catch (error) {
    return projectError(error, 'Unable to save the developer project.');
  }
}

export async function POST(request: Request) {
  return upsert(request);
}

export async function PATCH(request: Request) {
  return upsert(request);
}
