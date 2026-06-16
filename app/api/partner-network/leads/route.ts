import { NextResponse } from 'next/server';
import { partnerLeadSchema } from '@/lib/partner-network/schemas';
import { getPartnerSessionFromRequest } from '@/lib/partner-network/session';
import { createPartnerLead, getPartnerById, getPartnerDatabase, listPartnerLeads } from '@/lib/partner-network/store';

export async function GET(request: Request) {
  const session = getPartnerSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: 'Partner login required' }, { status: 401 });

  const db = await getPartnerDatabase();
  const result = await listPartnerLeads(db, { partnerId: session.partnerId, limit: 50 });
  return NextResponse.json(result);
}

export async function POST(request: Request) {
  const session = getPartnerSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: 'Partner login required' }, { status: 401 });

  try {
    const body = await request.json();
    const parsed = partnerLeadSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

    const db = await getPartnerDatabase();
    const partner = await getPartnerById(db, session.id);
    if (!partner) return NextResponse.json({ error: 'Partner not found' }, { status: 404 });

    const lead = await createPartnerLead(db, partner, {
      ...parsed.data,
      society: parsed.data.society || '',
      possessionDate: parsed.data.possessionDate || '',
      remarks: parsed.data.remarks || '',
    });

    return NextResponse.json({ ok: true, lead });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to submit lead' }, { status: 400 });
  }
}
