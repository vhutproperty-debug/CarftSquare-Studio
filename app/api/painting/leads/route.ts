import { NextResponse } from 'next/server';
import { PAINTING_LEAD_SOURCE } from '@/lib/painting/constants';
import { paintingLeadSubmitSchema } from '@/lib/painting/schemas';
import {
  createPaintingLead,
  ensurePaintingLeadIndexes,
  findRecentPaintingLeadByMobile,
  getPaintingDatabase,
  isValidPaintingMobile,
  normalizePaintingMobile,
} from '@/lib/painting/store';
import { INDIAN_MOBILE_ERROR } from '@/lib/phone/indian-mobile';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = paintingLeadSubmitSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const data = parsed.data;
    if (!isValidPaintingMobile(data.mobile)) {
      return NextResponse.json({ error: INDIAN_MOBILE_ERROR }, { status: 400 });
    }

    const normalizedMobile = normalizePaintingMobile(data.mobile);
    const db = await getPaintingDatabase();
    await ensurePaintingLeadIndexes(db);

    const duplicate = await findRecentPaintingLeadByMobile(db, normalizedMobile, 30);
    if (duplicate) {
      return NextResponse.json({
        success: true,
        duplicate: true,
        message: 'Thank you! Our painting team will contact you shortly.',
        lead: { id: duplicate.id },
      });
    }

    const lead = await createPaintingLead(db, {
      name: data.name,
      mobile: normalizedMobile,
      location: data.location,
      email: data.email || '',
      propertyType: data.propertyType || '',
      apartmentSize: data.apartmentSize || '',
      requirement: data.requirement || '',
      visitDate: data.visitDate || '',
      budget: data.budget || '',
      message: data.message || '',
      leadSource: PAINTING_LEAD_SOURCE,
    });

    return NextResponse.json(
      {
        success: true,
        message: 'Thank you! Our painting team will contact you shortly.',
        lead: { id: lead.id },
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
