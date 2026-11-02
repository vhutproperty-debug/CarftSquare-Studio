import { NextResponse } from 'next/server';
import { logOpsActivity } from '@/lib/ops/activity/store';
import { actorLabel, authorizeProjectRead, authorizeProjectWrite, deniedProjectAuth } from '@/lib/ops/projects/api-auth';
import { projectError } from '@/lib/ops/projects/http';
import { presentPortfolioOwner } from '@/lib/ops/portfolio/store';
import { getPortfolioDb, listPortfolio, savePortfolio } from '@/lib/ops/portfolio/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  const auth = await authorizeProjectRead(request);
  if (deniedProjectAuth(auth)) return auth.response;
  try {
    const url = new URL(request.url);
    const q = (url.searchParams.get('q') || '').toLowerCase();
    const project = url.searchParams.get('project') || '';
    const priority = url.searchParams.get('priority') || '';
    const owners = (await listPortfolio(await getPortfolioDb())).filter((owner) => {
      if (priority && owner.priority !== priority) return false;
      if (url.searchParams.get('nri') === '1' && !owner.nri) return false;
      if (url.searchParams.get('company') === '1' && !owner.company) return false;
      if (url.searchParams.get('broker') === '1' && !owner.broker) return false;
      if (url.searchParams.get('suspected') === '1' && !owner.suspected_broker) return false;
      if (url.searchParams.get('cross') === '1' && owner.projects.length < 2) return false;
      if (project && !owner.projects.includes(project)) return false;
      const hay = auth.canSeeSensitive
        ? [owner.name, owner.phone_e164, owner.projects.join(' ')]
        : [owner.name, owner.projects.join(' ')];
      if (q && !hay.join(' ').toLowerCase().includes(q)) return false;
      return true;
    });
    await logOpsActivity({
      action: 'view_portfolio_owners',
      actorId: auth.actor.id,
      actorEmail: auth.actor.email,
      resource: 'portfolio_owners',
      details: { shown: owners.length },
      request,
    });
    return NextResponse.json({
      items: owners.map((owner) => presentPortfolioOwner(owner, auth.canSeeSensitive)),
      projects: [...new Set(owners.flatMap((owner) => owner.projects))].sort(),
      canManage: auth.canManage,
      canSeePrivate: auth.canSeeSensitive,
    });
  } catch (error) {
    return projectError(error, 'Unable to load portfolio owners.');
  }
}

async function upsert(request: Request) {
  const auth = await authorizeProjectWrite(request);
  if (deniedProjectAuth(auth)) return auth.response;
  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Payload must be an object.' }, { status: 400 });
    const result = await savePortfolio(await getPortfolioDb(), body as Record<string, unknown>, actorLabel(auth.actor));
    await logOpsActivity({
      action: 'upsert_portfolio_owner',
      actorId: auth.actor.id,
      actorEmail: auth.actor.email,
      resource: 'portfolio_owners',
      resourceId: result.owner.id,
      details: { created: result.created, flats: result.owner.flats.length, via: auth.actor.via },
      request,
    });
    return NextResponse.json({ ok: true, created: result.created, owner: presentPortfolioOwner(result.owner, true) });
  } catch (error) {
    return projectError(error, 'Unable to save the owner.');
  }
}

export async function POST(request: Request) {
  return upsert(request);
}

export async function PATCH(request: Request) {
  return upsert(request);
}
