import { NextResponse } from 'next/server';
import { authResultToResponse } from '@/lib/auth/rbac/guard';
import { requireOpsViewAccess } from '@/lib/ops/auth';
import { fetchLeadDetails } from '@/lib/meta-leads/ingest';
import { getMetaAdsReadiness } from '@/lib/meta-ads/readiness';
import {
  fetchMetaLeadIntoInbox,
  getGrowthCaptureDb,
  listGrowthCaptures,
} from '@/lib/ops/growth/capture/store';
import { forbidBrokerGrowth, forbidUnlessGrowth, releaseList } from '@/lib/ops/os/guard';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const closed = forbidUnlessGrowth('LEAD_CAPTURE');
  if (closed) return closed;
  const auth = await requireOpsViewAccess(request);
  const denied = authResultToResponse(auth);
  if (denied) return denied;
  const broker = forbidBrokerGrowth(auth.admin);
  if (broker) return broker;
  const events = await listGrowthCaptures(await getGrowthCaptureDb());
  return NextResponse.json({ events: releaseList(auth.admin, events, 'client'), merged: false });
}

export async function POST(request: Request) {
  const closed = forbidUnlessGrowth('LEAD_CAPTURE');
  if (closed) return closed;
  const auth = await requireOpsViewAccess(request);
  const denied = authResultToResponse(auth);
  if (denied) return denied;
  const broker = forbidBrokerGrowth(auth.admin);
  if (broker) return broker;
  const body = await request.json().catch(() => null) as { leadgenId?: string } | null;
  const leadgenId = String(body?.leadgenId || '').trim();
  if (!leadgenId) return NextResponse.json({ error: 'A lead id is required.' }, { status: 400 });
  let permissions: string[] = [];
  try {
    permissions = (await getMetaAdsReadiness()).permissions;
  } catch {
    permissions = [];
  }
  const result = await fetchMetaLeadIntoInbox(await getGrowthCaptureDb(), {
    leadgenId,
    permissions,
    fetchLead: async (id) => {
      const details = await fetchLeadDetails(id);
      return details;
    },
  });
  return NextResponse.json({
    event: result.event,
    fetched: result.fetched,
    permission: permissions.includes('leads_retrieval') ? 'leads_retrieval' : 'missing',
  });
}
