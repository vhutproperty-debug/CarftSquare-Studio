import { NextResponse } from 'next/server';
import { requireAdminFromRequest } from '@/lib/auth/require-admin-api';
import { notifyStatusChanged } from '@/lib/estimate/integrations';
import { getDatabase, getQuoteById, toQuotationLead } from '@/lib/estimate/store';
import type { LeadStatus, QuotationQuote } from '@/lib/estimate/types';

const VALID_STATUSES: LeadStatus[] = ['new', 'contacted', 'meeting_scheduled', 'won', 'lost', 'site_visit', 'negotiation'];

export async function GET(request: Request) {
  const admin = await requireAdminFromRequest(request);
  if (!admin) return NextResponse.json({ error: 'Admin authentication required.' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q')?.trim().toLowerCase() || '';
  const status = searchParams.get('status')?.trim() || '';
  const moduleId = searchParams.get('moduleId')?.trim() || '';

  const filter: Record<string, unknown> = {};
  if (status && VALID_STATUSES.includes(status as LeadStatus)) {
    filter.status = status;
  }
  if (moduleId) {
    filter.moduleId = moduleId;
  }

  const db = await getDatabase();
  let quotes = (await db
    .collection('quotation_quotes')
    .find(filter, { projection: { _id: 0 } })
    .sort({ createdAt: -1 })
    .limit(500)
    .toArray()) as QuotationQuote[];

  if (q) {
    quotes = quotes.filter((quote) => {
      const haystack = [
        quote.quoteNumber,
        quote.customer?.name,
        quote.customer?.phone,
        quote.customer?.email,
        quote.answers.city,
        quote.leadSource,
        quote.landingPage,
        quote.aiSummary?.projectType,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }

  return NextResponse.json({ leads: quotes.map(toQuotationLead) });
}

export async function PUT(request: Request) {
  const admin = await requireAdminFromRequest(request);
  if (!admin) return NextResponse.json({ error: 'Admin authentication required.' }, { status: 401 });

  const body = await request.json();
  const { id, status, notes } = body;
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const db = await getDatabase();
  const existing = await getQuoteById(db, id);
  if (!existing) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });

  const patch: Partial<QuotationQuote> = { updatedAt: new Date().toISOString() };
  if (status) {
    if (!VALID_STATUSES.includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }
    patch.status = status;
  }
  if (typeof notes === 'string') {
    patch.notes = notes.slice(0, 2000);
  }

  await db.collection('quotation_quotes').updateOne({ id }, { $set: patch });
  const updated = await getQuoteById(db, id);

  if (updated && status && status !== existing.status) {
    await notifyStatusChanged(updated, existing.status);
  }

  return NextResponse.json({ message: 'Lead updated.', lead: updated ? toQuotationLead(updated) : null });
}
