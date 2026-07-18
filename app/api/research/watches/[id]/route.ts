import { NextResponse } from 'next/server';
import { authResultToResponse } from '@/lib/auth/rbac/guard';
import { requireResearchEditAccess, requireResearchViewAccess } from '@/lib/research/auth';
import { DEFAULT_RESEARCH_WORKSPACE } from '@/lib/research/business';
import { publicWatch } from '@/lib/research/monitoring/watch-crypto';
import {
  deleteWatch,
  getWatchById,
  updateWatch,
} from '@/lib/research/monitoring/watch-store';
import { runWatchNow } from '@/lib/research/monitoring/worker';

export const runtime = 'nodejs';
export const maxDuration = 300;

type Ctx = { params: { id: string } };

export async function GET(request: Request, { params }: Ctx) {
  const auth = await requireResearchViewAccess(request);
  const denied = authResultToResponse(auth);
  if (denied) return denied;
  const watch = await getWatchById(params.id);
  if (!watch) return NextResponse.json({ error: 'Watch not found.' }, { status: 404 });
  return NextResponse.json({ ok: true, watch: publicWatch(watch) });
}

export async function PATCH(request: Request, { params }: Ctx) {
  const auth = await requireResearchEditAccess(request);
  const denied = authResultToResponse(auth);
  if (denied) return denied;

  const body = await request.json().catch(() => ({}));
  if (body.action === 'run_now') {
    const watch = await getWatchById(params.id);
    if (!watch) return NextResponse.json({ error: 'Watch not found.' }, { status: 404 });
    const job = await runWatchNow(watch);
    return NextResponse.json({ ok: true, job });
  }

  const watch = await updateWatch(params.id, {
    name: typeof body.name === 'string' ? body.name : undefined,
    frequency: body.frequency,
    priority: body.priority,
    status: body.status,
    enabled: typeof body.enabled === 'boolean' ? body.enabled : undefined,
    filters: body.filters,
    naturalLanguage: body.naturalLanguage,
    searchStrategy: body.searchStrategy,
    landmark: body.landmark,
    savedSearchId: body.savedSearchId,
  });
  if (!watch) return NextResponse.json({ error: 'Watch not found.' }, { status: 404 });
  return NextResponse.json({ ok: true, watch: publicWatch(watch) });
}

export async function DELETE(request: Request, { params }: Ctx) {
  const auth = await requireResearchEditAccess(request);
  const denied = authResultToResponse(auth);
  if (denied) return denied;
  const workspaceId =
    new URL(request.url).searchParams.get('workspaceId') || DEFAULT_RESEARCH_WORKSPACE.id;
  const ok = await deleteWatch(params.id, workspaceId);
  if (!ok) return NextResponse.json({ error: 'Watch not found.' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
