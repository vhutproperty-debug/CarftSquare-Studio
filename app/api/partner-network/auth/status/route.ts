import { NextResponse } from 'next/server';
import {
  clearPartnerSessionCookieHeader,
  clearProfileSessionCookieHeader,
  getPartnerSessionFromRequest,
} from '@/lib/partner-network/session';
import { getPartnerById, getPartnerDatabase } from '@/lib/partner-network/store';

export async function GET(request: Request) {
  const session = getPartnerSessionFromRequest(request);
  if (!session) return NextResponse.json({ authenticated: false });

  const db = await getPartnerDatabase();
  const partner = await getPartnerById(db, session.id);
  if (!partner || partner.status !== 'approved') {
    return NextResponse.json({ authenticated: false });
  }

  return NextResponse.json({
    authenticated: true,
    partner: {
      partnerId: partner.partnerId,
      fullName: partner.fullName,
      email: partner.email,
      mobile: partner.mobile,
      companyName: partner.companyName,
    },
  });
}

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.headers.append('Set-Cookie', clearPartnerSessionCookieHeader());
  response.headers.append('Set-Cookie', clearProfileSessionCookieHeader());
  return response;
}
