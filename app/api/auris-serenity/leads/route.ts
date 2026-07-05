import { NextResponse } from 'next/server';
import { AURIS_LEAD_SOURCE } from '@/lib/auris-serenity/constants';
import { aurisSerenityLeadSubmitSchema } from '@/lib/auris-serenity/schemas';
import {
  createAurisSerenityLead,
  ensureAurisSerenityLeadIndexes,
  findRecentAurisLeadByMobile,
  getAurisSerenityDatabase,
  isValidAurisMobile,
  normalizeAurisMobile,
} from '@/lib/auris-serenity/store';
import { INDIAN_MOBILE_ERROR } from '@/lib/phone/indian-mobile';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = aurisSerenityLeadSubmitSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const data = parsed.data;
    const mobileInput = data.mobile?.trim() || '';
    const normalizedMobile = mobileInput ? normalizeAurisMobile(mobileInput) : '';

    if (mobileInput && !isValidAurisMobile(mobileInput)) {
      return NextResponse.json({ error: INDIAN_MOBILE_ERROR }, { status: 400 });
    }

    const db = await getAurisSerenityDatabase();
    await ensureAurisSerenityLeadIndexes(db);

    if (normalizedMobile) {
      const duplicate = await findRecentAurisLeadByMobile(db, normalizedMobile, 30);
      if (duplicate) {
        return NextResponse.json({
          success: true,
          duplicate: true,
          message: 'Thank you! Our team will connect with you on WhatsApp shortly.',
          lead: { id: duplicate.id },
        });
      }
    }

    const lead = await createAurisSerenityLead(db, {
      name: data.name?.trim() || '',
      mobile: normalizedMobile,
      selectedIntent: data.selectedIntent,
      possessionTimeline: data.possessionTimeline,
      pagePath: data.pagePath || '/auris-serenity',
      referrer: data.referrer || '',
      utm: data.utm || {},
    });

    return NextResponse.json(
      {
        success: true,
        message: 'Thank you! Our team will connect with you on WhatsApp shortly.',
        lead: { id: lead.id },
        source: AURIS_LEAD_SOURCE,
      },
      { status: 201 },
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Submission failed. Please try again.' },
      { status: 500 },
    );
  }
}
