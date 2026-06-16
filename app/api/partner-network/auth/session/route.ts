import { NextResponse } from 'next/server';
import {
  getPartnerProfileAuthFromRequest,
  getPartnerSessionFromRequest,
} from '@/lib/partner-network/session';
import { getPartnerById, getPartnerDatabase } from '@/lib/partner-network/store';

export const dynamic = 'force-dynamic';

function maskEmail(email: string) {
  if (!email?.includes('@')) return '***';
  const [user, domain] = email.split('@');
  return `${user.slice(0, 2)}***@${domain}`;
}

export async function GET(request: Request) {
  const session = getPartnerProfileAuthFromRequest(request);
  if (!session) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  const db = await getPartnerDatabase();
  const partner = await getPartnerById(db, session.id);
  if (!partner) {
    return NextResponse.json(
      { authenticated: false, error: 'Partner record not found. Please verify OTP again.' },
      { status: 404 },
    );
  }

  if (partner.partnerId !== session.partnerId) {
    return NextResponse.json(
      { authenticated: false, error: 'Session partner reference is invalid. Please verify OTP again.' },
      { status: 403 },
    );
  }

  const partnerSession = getPartnerSessionFromRequest(request);
  const scope = partnerSession ? 'partner' : 'profile';

  if (process.env.NODE_ENV === 'development') {
    console.log('[partner-network] session restore', {
      partnerId: partner.partnerId,
      email: maskEmail(partner.email),
      scope,
      status: partner.status,
    });
  }

  return NextResponse.json({
    authenticated: true,
    scope,
    partner: {
      id: partner.id,
      partnerId: partner.partnerId,
      fullName: partner.fullName,
      mobile: partner.mobile,
      email: partner.email,
      companyName: partner.companyName,
      status: partner.status,
      registrationStatus: partner.registrationStatus,
      profileCompletionPercent: partner.profileCompletionPercent,
    },
  });
}
