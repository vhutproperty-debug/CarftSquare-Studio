import { NextResponse } from 'next/server';
import { logOpsActivity } from '@/lib/ops/activity/store';
import { actorLabel, authorizeProjectRead, authorizeProjectWrite, deniedProjectAuth } from '@/lib/ops/projects/api-auth';
import { projectError } from '@/lib/ops/projects/http';
import { expiryBucket } from '@/lib/ops/rerent/types';
import { getRerentDb, listRerent, saveRerent } from '@/lib/ops/rerent/store';
import type { ExpiryBucket } from '@/lib/ops/rerent/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  const auth = await authorizeProjectRead(request);
  if (deniedProjectAuth(auth)) return auth.response;
  try {
    const url = new URL(request.url);
    const bucket = (url.searchParams.get('bucket') || '') as ExpiryBucket | '';
    const project = url.searchParams.get('project') || '';
    const status = url.searchParams.get('status') || '';
    const q = (url.searchParams.get('q') || '').toLowerCase();
    const all = await listRerent(await getRerentDb());
    const projects = [...new Set(all.map((lease) => lease.project).filter(Boolean))].sort();
    const leases = all.filter((lease) => {
      if (bucket && expiryBucket(lease.lease_end) !== bucket) return false;
      if (project && lease.project !== project) return false;
      if (status && lease.status !== status) return false;
      if (q && ![lease.name, lease.project, lease.tower, lease.phone_e164, lease.flat].join(' ').toLowerCase().includes(q)) return false;
      return true;
    }).sort((a, b) => (a.lease_end || '9999').localeCompare(b.lease_end || '9999'));
    await logOpsActivity({
      action: 'view_rerent',
      actorId: auth.actor.id,
      actorEmail: auth.actor.email,
      resource: 'rerent_leases',
      details: { shown: leases.length },
      request,
    });
    return NextResponse.json({
      items: leases.map((lease) => ({ ...lease, bucket: expiryBucket(lease.lease_end) })),
      projects,
      canManage: auth.canManage,
    });
  } catch (error) {
    return projectError(error, 'Unable to load lease expiries.');
  }
}

async function upsert(request: Request) {
  const auth = await authorizeProjectWrite(request);
  if (deniedProjectAuth(auth)) return auth.response;
  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Payload must be an object.' }, { status: 400 });
    const result = await saveRerent(await getRerentDb(), body as Record<string, unknown>, actorLabel(auth.actor));
    await logOpsActivity({
      action: 'upsert_rerent',
      actorId: auth.actor.id,
      actorEmail: auth.actor.email,
      resource: 'rerent_leases',
      resourceId: result.lease.id,
      details: { created: result.created, via: auth.actor.via },
      request,
    });
    return NextResponse.json({ ok: true, created: result.created, lease: { ...result.lease, bucket: expiryBucket(result.lease.lease_end) } });
  } catch (error) {
    return projectError(error, 'Unable to save the lease.');
  }
}

export async function POST(request: Request) {
  return upsert(request);
}

export async function PATCH(request: Request) {
  return upsert(request);
}
