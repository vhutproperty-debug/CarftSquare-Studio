import { NextResponse } from 'next/server';
import { partnerCallbackRequestSchema } from '@/lib/partner-callback/schemas';
import {
  createCallbackRequest,
  ensureCallbackRequestIndexes,
  findRecentCallbackByMobile,
  isValidCallbackMobile,
} from '@/lib/partner-callback/store';
import { getPartnerDatabase } from '@/lib/partner-network/store';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = partnerCallbackRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Please enter a valid mobile number.' }, { status: 400 });
    }

    if (!isValidCallbackMobile(parsed.data.mobile)) {
      return NextResponse.json({ error: 'Please enter a valid 10-digit mobile number.' }, { status: 400 });
    }

    const db = await getPartnerDatabase();
    await ensureCallbackRequestIndexes(db);

    const duplicate = await findRecentCallbackByMobile(db, parsed.data.mobile);
    if (duplicate) {
      return NextResponse.json({
        success: true,
        duplicate: true,
        message: 'Thank you! Our team will contact you shortly.',
      });
    }

    const record = await createCallbackRequest(db, {
      name: parsed.data.name,
      mobile: parsed.data.mobile,
    });

    return NextResponse.json(
      {
        success: true,
        message: 'Thank you! Our team will contact you shortly.',
        request: { id: record.id },
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
