import { NextResponse } from 'next/server';
import { designerCallbackSchema } from '@/lib/designer-leads/schemas';
import {
  createDesignerCallbackLead,
  ensureDesignerLeadIndexes,
  findRecentDesignerLeadByPhone,
  getDatabase,
  isValidDesignerPhone,
} from '@/lib/designer-leads/store';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = designerCallbackSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const data = parsed.data;

    if (!isValidDesignerPhone(data.phone)) {
      return NextResponse.json({ error: 'Please enter a valid 10-digit mobile number.' }, { status: 400 });
    }

    const db = await getDatabase();
    await ensureDesignerLeadIndexes(db);

    const duplicate = await findRecentDesignerLeadByPhone(db, data.phone, 30);
    if (duplicate) {
      return NextResponse.json({
        success: true,
        duplicate: true,
        message: 'Thank you! Our design team will contact you shortly.',
        lead: { id: duplicate.id },
      });
    }

    const lead = await createDesignerCallbackLead(db, {
      name: data.name,
      phone: data.phone,
      city: data.city || '',
      projectType: data.projectType || '',
      message: data.message || '',
      preferredCallTime: data.preferredCallTime || '',
      landingPage: data.landingPage || '/',
      source: data.fromAiChat ? 'AI Chat Callback' : 'Human Designer Request',
      aiContext: data.aiContext || null,
    });

    return NextResponse.json(
      {
        success: true,
        message: 'Thank you! Our design team will contact you shortly.',
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
