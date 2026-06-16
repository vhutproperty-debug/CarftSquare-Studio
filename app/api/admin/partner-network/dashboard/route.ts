import { NextResponse } from 'next/server';
import { authorizeRequest } from '@/lib/auth/require-admin-api';
import { authResultToResponse } from '@/lib/auth/rbac/guard';
import { MODULES } from '@/lib/auth/rbac/modules';
import {
  exportLeadsCsv,
  exportPartnersCsv,
  getAdminDashboardStats,
  getPartnerDatabase,
  getTopPartners,
  getTrustCounters,
} from '@/lib/partner-network/store';

export async function GET(request: Request) {
  const auth = await authorizeRequest(request, { permission: MODULES.PARTNER_NETWORK, action: 'view' });
  const denied = authResultToResponse(auth);
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  const exportType = searchParams.get('export');

  const db = await getPartnerDatabase();

  if (exportType === 'partners-csv') {
    const csv = await exportPartnersCsv(db);
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="partners.csv"',
      },
    });
  }

  if (exportType === 'leads-csv') {
    const csv = await exportLeadsCsv(db);
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="partner-leads.csv"',
      },
    });
  }

  const [stats, topPartners, counters] = await Promise.all([
    getAdminDashboardStats(db),
    getTopPartners(db, 10),
    getTrustCounters(db),
  ]);

  return NextResponse.json({ stats, topPartners, trustCounters: counters });
}
