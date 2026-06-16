import { NextResponse } from 'next/server';
import { partnerQuickRegistrationSchema } from '@/lib/partner-network/schemas';
import {
  createPartnerQuick,
  ensurePartnerNetworkIndexes,
  getPartnerDatabase,
  saveOtpSession,
} from '@/lib/partner-network/store';
import { notifyAdminNewPartner } from '@/lib/partner-network/notifications';
import { dispatchOtpNotification, generateOtp, getOtpExpiry, hashOtp } from '@/lib/partner-network/otp';

function formatApiError(error: unknown) {
  if (error instanceof Error) {
    if (error.message.includes('conflict at \'value\'')) {
      return 'Registration counter conflict. Please try again.';
    }
    return error.message;
  }
  return 'Registration failed';
}

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (process.env.NODE_ENV === 'development') {
      console.log('[partner-network] POST /register/quick body', body);
    }
    const parsed = partnerQuickRegistrationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
    }

    const db = await getPartnerDatabase();
    await ensurePartnerNetworkIndexes(db);
    const partner = await createPartnerQuick(db, {
      ...parsed.data,
      companyName: parsed.data.companyName ?? '',
    });

    notifyAdminNewPartner({ partnerId: partner.partnerId, fullName: partner.fullName }).catch(() => {});

    const otp = generateOtp();
    await saveOtpSession(db, partner.mobile, hashOtp(otp, partner.mobile), getOtpExpiry());

    if (process.env.NODE_ENV === 'development') {
      console.log('[partner-network] register/quick partner ready', {
        partnerId: partner.partnerId,
        email: partner.email,
        mobile: partner.mobile,
        status: partner.status,
      });
    }

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
      return NextResponse.json({ error: 'Unable to send verification email. Please try again.' }, { status: 503 });
    }

    return NextResponse.json({
      ok: true,
      requiresOtp: true,
      partnerId: partner.partnerId,
      id: partner.id,
      mobile: partner.mobile,
      email: partner.email,
      status: partner.status,
      registrationStatus: partner.registrationStatus,
      profileCompletionPercent: partner.profileCompletionPercent,
      message: 'Account created. Enter the OTP sent to your email to continue.',
      channels: delivery.whatsapp.delivered ? ['email', 'whatsapp'] : ['email'],
      emailDelivered: delivery.email.delivered,
    });
  } catch (error) {
    const message = formatApiError(error);
    if (process.env.NODE_ENV === 'development') {
      console.error('[partner-network] POST /register/quick error', error);
    }
    const status = /Missing required environment variable|EMAIL_FROM|Resend|Email provider|domain is not verified|send testing emails/i.test(message)
      ? 503
      : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
