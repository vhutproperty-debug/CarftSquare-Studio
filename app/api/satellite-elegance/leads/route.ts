import { NextResponse } from 'next/server';
import { SATELLITE_LEAD_SOURCE } from '@/lib/satellite-elegance/constants';
import { satelliteEleganceLeadSubmitSchema } from '@/lib/satellite-elegance/schemas';
import {
  createSatelliteEleganceLead,
  ensureSatelliteEleganceLeadIndexes,
  findRecentSatelliteLeadByMobile,
  getSatelliteEleganceDatabase,
  isValidSatelliteMobile,
  normalizeSatelliteMobile,
} from '@/lib/satellite-elegance/store';
import { INDIAN_MOBILE_ERROR } from '@/lib/phone/indian-mobile';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = satelliteEleganceLeadSubmitSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const data = parsed.data;
    const mobileInput = data.mobile?.trim() || '';
    const normalizedMobile = mobileInput ? normalizeSatelliteMobile(mobileInput) : '';

    if (mobileInput && !isValidSatelliteMobile(mobileInput)) {
      return NextResponse.json({ error: INDIAN_MOBILE_ERROR }, { status: 400 });
    }

    const db = await getSatelliteEleganceDatabase();
    await ensureSatelliteEleganceLeadIndexes(db);

    if (normalizedMobile) {
      const duplicate = await findRecentSatelliteLeadByMobile(db, normalizedMobile, 30);
      if (duplicate) {
        return NextResponse.json({
          success: true,
          duplicate: true,
          message: 'Thank you! Our team will connect with you on WhatsApp shortly.',
          lead: { id: duplicate.id },
        });
      }
    }

    const lead = await createSatelliteEleganceLead(db, {
      name: data.name?.trim() || '',
      mobile: normalizedMobile,
      selectedIntent: data.selectedIntent,
      possessionTimeline: data.possessionTimeline,
      pagePath: data.pagePath || '/satellite-elegance',
      referrer: data.referrer || '',
      utm: data.utm || {},
    });

    return NextResponse.json(
      {
        success: true,
        message: 'Thank you! Our team will connect with you on WhatsApp shortly.',
        lead: { id: lead.id },
        source: SATELLITE_LEAD_SOURCE,
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
