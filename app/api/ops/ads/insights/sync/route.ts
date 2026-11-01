import { NextResponse } from 'next/server';
import { authorizeCron } from '@/lib/ops/cron-auth';
import { syncMetaAdsInsights } from '@/lib/meta-ads/insights';
import { getMetaAdsDatabase } from '@/lib/meta-ads/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const denied = await authorizeCron(request);
  if (denied) return denied;
  try {
    const db = await getMetaAdsDatabase();
    const result = await syncMetaAdsInsights(db);
    return NextResponse.json(result);
  } catch (error) {
    console.error('[ops-ads] insights_sync_failed', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Unable to sync insights.' }, { status: 500 });
  }
}
