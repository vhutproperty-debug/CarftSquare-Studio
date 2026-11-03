import { NextResponse } from 'next/server';
import { authResultToResponse } from '@/lib/auth/rbac/guard';
import { requireOpsViewAccess } from '@/lib/ops/auth';
import { getGrowthDb, inventoryOffers, listDemandProfiles, profileMatches, saveDemandProfile } from '@/lib/ops/growth/demand/store';
import type { DemandIntent } from '@/lib/ops/growth/demand/profile';
import { forbidBrokerGrowth, forbidUnlessGrowth, releaseList } from '@/lib/ops/os/guard';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const closed = forbidUnlessGrowth('DEMAND_PROFILER');
  if (closed) return closed;
  const auth = await requireOpsViewAccess(request);
  const denied = authResultToResponse(auth);
  if (denied) return denied;
  const broker = forbidBrokerGrowth(auth.admin);
  if (broker) return broker;
  const db = await getGrowthDb();
  const url = new URL(request.url);
  const id = url.searchParams.get('id');
  if (id) {
    const result = await profileMatches(db, id);
    if (!result) return NextResponse.json({ error: 'Profile not found.' }, { status: 404 });
    return NextResponse.json(result);
  }
  const [profiles, offers] = await Promise.all([listDemandProfiles(db), inventoryOffers(db)]);
  return NextResponse.json({
    profiles: releaseList(auth.admin, profiles, 'client'),
    offers: offers.length,
  });
}

export async function POST(request: Request) {
  const closed = forbidUnlessGrowth('DEMAND_PROFILER');
  if (closed) return closed;
  const auth = await requireOpsViewAccess(request);
  const denied = authResultToResponse(auth);
  if (denied) return denied;
  const broker = forbidBrokerGrowth(auth.admin);
  if (broker) return broker;
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: 'A demand profile is required.' }, { status: 400 });
  const answers = body.answers && typeof body.answers === 'object' ? body.answers as Record<string, string> : {};
  try {
    const saved = await saveDemandProfile(await getGrowthDb(), {
      answers,
      contactId: body.contactId ? String(body.contactId) : '',
      sourceEventId: body.sourceEventId ? String(body.sourceEventId) : '',
      budgetMin: body.budgetMin == null || body.budgetMin === '' ? undefined : Number(body.budgetMin),
      budgetMax: body.budgetMax == null || body.budgetMax === '' ? undefined : Number(body.budgetMax),
      configuration: body.configuration == null ? undefined : String(body.configuration),
      location: body.location == null ? undefined : String(body.location),
      possession: body.possession == null ? undefined : String(body.possession),
      intent: body.intent == null ? undefined : String(body.intent) as DemandIntent,
    }, auth.admin.id);
    return NextResponse.json(saved, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to save the profile.' }, { status: 400 });
  }
}
