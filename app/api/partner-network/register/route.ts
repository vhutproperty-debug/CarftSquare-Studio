import { NextResponse } from 'next/server';
import { partnerRegistrationSchema } from '@/lib/partner-network/schemas';
import { createPartner, ensurePartnerNetworkIndexes, getPartnerDatabase } from '@/lib/partner-network/store';
import { notifyAdminNewPartner } from '@/lib/partner-network/notifications';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = partnerRegistrationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const db = await getPartnerDatabase();
    await ensurePartnerNetworkIndexes(db);
    const partner = await createPartner(db, {
      ...parsed.data,
      dealType: parsed.data.dealType,
      reraNumber: parsed.data.reraNumber || undefined,
      leadSource: (body.leadSource as string) || 'organic',
    });

    notifyAdminNewPartner({ partnerId: partner.partnerId, fullName: partner.fullName }).catch(() => {});

    return NextResponse.json({
      ok: true,
      partnerId: partner.partnerId,
      message: 'Registration submitted. You will receive approval notification shortly.',
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Registration failed' },
      { status: 400 },
    );
  }
}
