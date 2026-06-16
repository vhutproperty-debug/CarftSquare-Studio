import { NextResponse } from 'next/server';
import { getPartnerSessionFromRequest } from '@/lib/partner-network/session';
import {
  getPartnerById,
  getPartnerDashboardStats,
  getPartnerDatabase,
  listActivityForPartner,
  listPartnerLeads,
} from '@/lib/partner-network/store';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const session = getPartnerSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: 'Partner login required' }, { status: 401 });

  const db = await getPartnerDatabase();
  const [partner, stats, leads, activity] = await Promise.all([
    getPartnerById(db, session.id),
    getPartnerDashboardStats(db, session.partnerId),
    listPartnerLeads(db, { partnerId: session.partnerId, limit: 50 }),
    listActivityForPartner(db, session.partnerId, session.id, 50),
  ]);

  return NextResponse.json({ partner, stats, leads: leads.leads, activity });
}
