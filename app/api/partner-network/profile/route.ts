import { NextResponse } from 'next/server';
import { partnerProfileUpdateSchema } from '@/lib/partner-network/schemas';
import { getPartnerProfileAuthFromRequest } from '@/lib/partner-network/session';
import {
  ensurePartnerNetworkIndexes,
  getPartnerById,
  getPartnerDatabase,
  updatePartnerProfile,
} from '@/lib/partner-network/store';

export const dynamic = 'force-dynamic';

function maskEmail(email: string) {
  if (!email?.includes('@')) return '***';
  const [user, domain] = email.split('@');
  return `${user.slice(0, 2)}***@${domain}`;
}

export async function PATCH(request: Request) {
  try {
    const session = getPartnerProfileAuthFromRequest(request);
    if (!session) {
      return NextResponse.json(
        { error: 'Authentication required. Please verify OTP first.' },
        { status: 401 },
      );
    }

    const body = await request.json();
    const parsed = partnerProfileUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const db = await getPartnerDatabase();
    await ensurePartnerNetworkIndexes(db);

    const partner = await getPartnerById(db, session.id);
    if (!partner) {
      return NextResponse.json(
        { error: 'Partner record not found for your session. Please verify OTP again.' },
        { status: 404 },
      );
    }

    if (partner.partnerId !== session.partnerId) {
      if (process.env.NODE_ENV === 'development') {
        console.error('[partner-network] profile session mismatch', {
          sessionPartnerId: session.partnerId,
          recordPartnerId: partner.partnerId,
          sessionId: session.id,
        });
      }
      return NextResponse.json(
        { error: 'Session partner reference is invalid. Please verify OTP again.' },
        { status: 403 },
      );
    }

    if (parsed.data.partnerId && parsed.data.partnerId !== session.partnerId) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('[partner-network] profile client partnerId mismatch — using session', {
          clientPartnerId: parsed.data.partnerId,
          sessionPartnerId: session.partnerId,
        });
      }
    }

    const { agreementAccepted, partnerId: _ignoredPartnerId, mobile: _ignoredMobile, ...profile } = parsed.data;

    if (process.env.NODE_ENV === 'development') {
      console.log('[partner-network] profile PATCH', {
        partnerId: session.partnerId,
        email: maskEmail(partner.email),
        sessionScope: session.scope || 'partner',
      });
    }

    const updated = await updatePartnerProfile(db, partner.partnerId, undefined, {
      ...profile,
      agreementAccepted: agreementAccepted ?? undefined,
      dealType: profile.dealType,
      reraNumber: profile.reraNumber || undefined,
      email: profile.email || partner.email || undefined,
    });

    if (!updated) {
      return NextResponse.json({ error: 'Partner not found after profile save.' }, { status: 404 });
    }

    if (process.env.NODE_ENV === 'development') {
      console.log('[partner-network] profile saved', {
        partnerId: updated.partnerId,
        registrationStatus: updated.registrationStatus,
        profileCompletionPercent: updated.profileCompletionPercent,
        status: updated.status,
      });
    }

    const nextStep = updated.status === 'approved' && updated.registrationStatus === 'complete'
      ? 'dashboard'
      : updated.status === 'approved'
        ? 'profile'
        : 'pending';

    return NextResponse.json({
      ok: true,
      partnerId: updated.partnerId,
      registrationStatus: updated.registrationStatus,
      profileCompletionPercent: updated.profileCompletionPercent,
      status: updated.status,
      nextStep,
      message: updated.registrationStatus === 'complete'
        ? updated.status === 'approved'
          ? 'Profile complete! Redirecting to your dashboard.'
          : 'Profile complete! We will review and notify you upon approval.'
        : 'Profile saved. Add more details anytime to complete your partner profile.',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Profile update failed';
    if (process.env.NODE_ENV === 'development') {
      console.error('[partner-network] profile PATCH failed', { error: message });
    }
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
