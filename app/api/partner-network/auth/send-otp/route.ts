import { NextResponse } from 'next/server';
import { otpSendSchema } from '@/lib/partner-network/schemas';
import { dispatchOtpNotification, generateOtp, getOtpExpiry, hashOtp } from '@/lib/partner-network/otp';
import { getPartnerDatabase, resolvePartnerByIdentifier, saveOtpSession } from '@/lib/partner-network/store';

export const dynamic = 'force-dynamic';

function resolveIdentifier(data: { identifier?: string; mobile?: string }) {
  return String(data.identifier || data.mobile || '').trim();
}

function maskEmail(email: string) {
  if (!email?.includes('@')) return '***';
  const [user, domain] = email.split('@');
  return `${user.slice(0, 2)}***@${domain}`;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = otpSendSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: 'Enter a valid mobile number or email address' }, { status: 400 });

    const identifier = resolveIdentifier(parsed.data);
    const purpose = parsed.data.purpose || 'login';

    const db = await getPartnerDatabase();
    const partner = await resolvePartnerByIdentifier(db, identifier);
    if (!partner) {
      return NextResponse.json({ error: 'Partner not found. Please create an account first.' }, { status: 404 });
    }

    if (purpose === 'login' && partner.status !== 'approved') {
      return NextResponse.json({ error: 'Partner account is not approved yet.' }, { status: 403 });
    }

    const email = String(partner.email || '').trim().toLowerCase();
    if (!email || !email.includes('@')) {
      return NextResponse.json(
        { error: 'No email on your partner account. Please register again or contact support.' },
        { status: 422 },
      );
    }

    const otp = generateOtp();
    await saveOtpSession(db, partner.mobile, hashOtp(otp, partner.mobile), getOtpExpiry());

    const delivery = await dispatchOtpNotification(
      {
        email: partner.email,
        mobile: partner.mobile,
        whatsapp: partner.whatsapp,
        fullName: partner.fullName,
      },
      otp,
    );

    if (!delivery.email.delivered && !delivery.devLogged) {
      return NextResponse.json(
        { error: 'Unable to send OTP email right now. Please try again shortly.' },
        { status: 503 },
      );
    }

    const channels = [];
    if (delivery.email.delivered || delivery.devLogged) channels.push('email');
    if (delivery.whatsapp.delivered) channels.push('whatsapp');

    console.info('[partner-otp] send complete', {
      partnerId: partner.partnerId,
      purpose,
      email: maskEmail(email),
      channels,
    });

    let message = 'OTP sent to your registered email.';
    if (delivery.whatsapp.delivered) {
      message = 'OTP sent to your registered email and WhatsApp.';
    }

    return NextResponse.json({
      ok: true,
      message,
      channels,
      partnerMobile: partner.mobile,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Failed to send OTP';
    let status = 500;
    if (msg.includes('Too many OTP')) status = 429;
    else if (/EMAIL_FROM|Resend|Email provider|domain is not verified|send testing emails/i.test(msg)) status = 503;
    console.error('[partner-otp] send failed', { error: msg });
    return NextResponse.json({ error: msg }, { status });
  }
}
