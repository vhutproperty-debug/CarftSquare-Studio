import { NextResponse } from 'next/server';
import { otpVerifySchema } from '@/lib/partner-network/schemas';
import { hashOtp, isOtpExpired, OTP_MAX_VERIFY_ATTEMPTS } from '@/lib/partner-network/otp';
import {
  deleteOtpSession,
  getPartnerDatabase,
  getOtpSession,
  incrementOtpAttempts,
  resolvePartnerByIdentifier,
} from '@/lib/partner-network/store';
import {
  clearProfileSessionCookieHeader,
  partnerSessionCookieHeader,
  profileSessionCookieHeader,
  signPartnerSession,
  signProfileSession,
} from '@/lib/partner-network/session';

export const dynamic = 'force-dynamic';

function resolveIdentifier(data: { identifier?: string; mobile?: string }) {
  return String(data.identifier || data.mobile || '').trim();
}

function buildNextStep(partner: { status: string; registrationStatus: string }) {
  if (partner.status !== 'approved') return 'profile';
  if (partner.registrationStatus === 'incomplete') return 'profile';
  return 'dashboard';
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = otpVerifySchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: 'Invalid OTP' }, { status: 400 });

    const identifier = resolveIdentifier(parsed.data);
    const db = await getPartnerDatabase();
    const partner = await resolvePartnerByIdentifier(db, identifier);
    if (!partner) {
      return NextResponse.json({ error: 'Partner not found' }, { status: 404 });
    }

    const session = await getOtpSession(db, partner.mobile);
    if (!session) {
      return NextResponse.json({ error: 'OTP expired or not requested. Please request a new code.' }, { status: 400 });
    }
    if (isOtpExpired(session.expiresAt)) {
      await deleteOtpSession(db, partner.mobile);
      return NextResponse.json({ error: 'OTP expired. Please request a new one.' }, { status: 400 });
    }

    const attempts = Number(session.attempts || 0);
    if (attempts >= OTP_MAX_VERIFY_ATTEMPTS) {
      await deleteOtpSession(db, partner.mobile);
      return NextResponse.json({ error: 'Too many failed attempts. Please request a new OTP.' }, { status: 429 });
    }

    if (session.otpHash !== hashOtp(parsed.data.otp, partner.mobile)) {
      await incrementOtpAttempts(db, partner.mobile);
      const remaining = OTP_MAX_VERIFY_ATTEMPTS - attempts - 1;
      return NextResponse.json(
        { error: remaining > 0 ? `Invalid OTP. ${remaining} attempt(s) remaining.` : 'Invalid OTP.' },
        { status: 401 },
      );
    }

    await deleteOtpSession(db, partner.mobile);

    const nextStep = buildNextStep(partner);
    const partnerPayload = {
      id: partner.id,
      partnerId: partner.partnerId,
      fullName: partner.fullName,
      mobile: partner.mobile,
      email: partner.email,
      companyName: partner.companyName,
      status: partner.status,
      registrationStatus: partner.registrationStatus,
      profileCompletionPercent: partner.profileCompletionPercent,
    };

    if (process.env.NODE_ENV === 'development') {
      console.log('[partner-network] OTP verified', {
        partnerId: partner.partnerId,
        email: partner.email?.includes('@') ? `${partner.email.split('@')[0].slice(0, 2)}***@${partner.email.split('@')[1]}` : '***',
        nextStep,
        status: partner.status,
      });
    }

    const response = NextResponse.json({ ok: true, nextStep, partner: partnerPayload });

    if (partner.status === 'approved') {
      const token = signPartnerSession({ partnerId: partner.partnerId, id: partner.id, mobile: partner.mobile });
      response.headers.append('Set-Cookie', partnerSessionCookieHeader(token));
      response.headers.append('Set-Cookie', clearProfileSessionCookieHeader());
      if (process.env.NODE_ENV === 'development') {
        console.log('[partner-network] partner session created', { partnerId: partner.partnerId });
      }
    } else {
      const token = signProfileSession({ partnerId: partner.partnerId, id: partner.id, mobile: partner.mobile });
      response.headers.append('Set-Cookie', profileSessionCookieHeader(token));
      if (process.env.NODE_ENV === 'development') {
        console.log('[partner-network] profile session created', { partnerId: partner.partnerId });
      }
    }

    return response;
  } catch (error) {
    console.error('[partner-otp] verify failed', { error: error instanceof Error ? error.message : error });
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Verification failed' }, { status: 500 });
  }
}
