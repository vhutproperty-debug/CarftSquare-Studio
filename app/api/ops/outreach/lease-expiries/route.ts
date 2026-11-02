import { NextResponse } from 'next/server';
import { logOpsActivity } from '@/lib/ops/activity/store';
import { daysToExpiry, LEASE_BUCKETS, leaseBucket, type LeaseBucket } from '@/lib/ops/lease-expiries/types';
import { getLeaseDatabase, listLeaseExpiries, saveLeaseExpiry } from '@/lib/ops/lease-expiries/store';
import { actorLabel, authorizeProjectRead, authorizeProjectWrite, deniedProjectAuth } from '@/lib/ops/projects/api-auth';
import { projectError } from '@/lib/ops/projects/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  const auth = await authorizeProjectRead(request);
  if (deniedProjectAuth(auth)) return auth.response;
  try {
    const url = new URL(request.url);
    const bucket = url.searchParams.get('bucket') || '';
    const project = url.searchParams.get('project') || '';
    const all = await listLeaseExpiries(await getLeaseDatabase());
    const inProject = project ? all.filter((lease) => lease.project === project) : all;
    const counts = Object.fromEntries(LEASE_BUCKETS.map((item) => [item, 0])) as Record<LeaseBucket, number>;
    inProject.forEach((lease) => {
      const band = leaseBucket(lease.leaseEnd);
      if (band) counts[band] += 1;
    });
    const items = inProject
      .filter((lease) => !bucket || leaseBucket(lease.leaseEnd) === bucket)
      .map((lease) => ({ ...lease, daysToExpiry: daysToExpiry(lease.leaseEnd), bucket: leaseBucket(lease.leaseEnd) }))
      .sort((a, b) => {
        if (a.daysToExpiry == null) return 1;
        if (b.daysToExpiry == null) return -1;
        return a.daysToExpiry - b.daysToExpiry;
      });
    await logOpsActivity({
      action: 'view_lease_expiries',
      actorId: auth.actor.id,
      actorEmail: auth.actor.email,
      resource: 'lease_expiries',
      details: { shown: items.length },
      request,
    });
    return NextResponse.json({
      items,
      counts,
      projects: [...new Set(all.map((lease) => lease.project).filter(Boolean))].sort(),
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
    const result = await saveLeaseExpiry(await getLeaseDatabase(), body as Record<string, unknown>, actorLabel(auth.actor));
    await logOpsActivity({
      action: 'upsert_lease_expiry',
      actorId: auth.actor.id,
      actorEmail: auth.actor.email,
      resource: 'lease_expiries',
      resourceId: result.lease.id,
      details: { created: result.created, project: result.lease.project, via: auth.actor.via },
      request,
    });
    return NextResponse.json({
      ok: true,
      created: result.created,
      lease: { ...result.lease, daysToExpiry: daysToExpiry(result.lease.leaseEnd), bucket: leaseBucket(result.lease.leaseEnd) },
    });
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
