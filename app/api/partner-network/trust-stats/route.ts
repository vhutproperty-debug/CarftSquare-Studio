import { NextResponse } from 'next/server';
import { getPartnerDatabase, getTrustCounters } from '@/lib/partner-network/store';

export const revalidate = 300;

export async function GET() {
  try {
    const db = await getPartnerDatabase();
    const counters = await getTrustCounters(db);
    return NextResponse.json({ counters }, {
      headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
    });
  } catch {
    const { DEFAULT_TRUST_COUNTERS } = await import('@/lib/partner-network/constants');
    return NextResponse.json({ counters: DEFAULT_TRUST_COUNTERS });
  }
}
