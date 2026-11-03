import { NextResponse } from 'next/server';
import { authResultToResponse } from '@/lib/auth/rbac/guard';
import { requireOpsViewAccess } from '@/lib/ops/auth';
import { readCampaignInsights } from '@/lib/meta-ads/insights';
import { buildRevenueReport, getRevenueGrowthDb, linkLeadToDeal, type SpendRow } from '@/lib/ops/growth/revenue/store';
import { forbidBrokerGrowth, forbidUnlessGrowth, forbidUnlessOps } from '@/lib/ops/os/guard';

export const dynamic = 'force-dynamic';

async function readSpend(): Promise<{ rows: SpendRow[] | null; error: string }> {
  try {
    const rows = await readCampaignInsights({ preset: 'last_30d' });
    return { rows: rows.map((row) => ({ campaignId: row.campaignId, campaignName: row.campaignName, spend: row.spend })), error: '' };
  } catch (error) {
    return { rows: null, error: error instanceof Error ? error.message : 'Meta insights are not available.' };
  }
}

export async function GET(request: Request) {
  const closed = forbidUnlessGrowth('REVENUE');
  if (closed) return closed;
  const auth = await requireOpsViewAccess(request);
  const denied = authResultToResponse(auth);
  if (denied) return denied;
  if (!auth.ok) return denied;
  const broker = forbidBrokerGrowth(auth.admin);
  if (broker) return broker;
  const hidden = forbidUnlessOps(auth.admin, 'see_internal_brokerage');
  if (hidden) return hidden;
  const report = await buildRevenueReport(await getRevenueGrowthDb(), await readSpend());
  return NextResponse.json(report);
}

export async function POST(request: Request) {
  const closed = forbidUnlessGrowth('REVENUE');
  if (closed) return closed;
  const auth = await requireOpsViewAccess(request);
  const denied = authResultToResponse(auth);
  if (denied) return denied;
  if (!auth.ok) return denied;
  const broker = forbidBrokerGrowth(auth.admin);
  if (broker) return broker;
  const hidden = forbidUnlessOps(auth.admin, 'see_internal_brokerage');
  if (hidden) return hidden;
  const body = await request.json().catch(() => null) as { leadId?: string; dealId?: string } | null;
  try {
    const link = await linkLeadToDeal(await getRevenueGrowthDb(), {
      leadId: String(body?.leadId || ''),
      dealId: String(body?.dealId || ''),
    }, auth.admin.id);
    return NextResponse.json({ link, dealUpdated: false }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to link the lead.' }, { status: 400 });
  }
}
