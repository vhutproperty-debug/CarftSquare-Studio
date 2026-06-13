import { NextResponse } from 'next/server';
import { authorizeRequest } from '@/lib/auth/require-admin-api';
import { authResultToResponse } from '@/lib/auth/rbac/guard';
import { PERMISSIONS } from '@/lib/auth/rbac/permissions';
import { notifyStatusChanged } from '@/lib/estimate/integrations';
import { getDatabase, getQuoteById, toQuotationLead } from '@/lib/estimate/store';
import type { LeadStatus, QuotationQuote } from '@/lib/estimate/types';

const VALID_STATUSES: LeadStatus[] = ['new', 'contacted', 'meeting_scheduled', 'won', 'lost', 'site_visit', 'negotiation'];

export async function GET(request: Request) {
  const auth = await authorizeRequest(request, { permission: PERMISSIONS.AI_QUOTES });
  const denied = authResultToResponse(auth);
  if (denied) return denied;

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
    quotes = quotes.filter((quote) =>
      [
        quote.quoteNumber,
        quote.id,
        quote.answers.name,
        quote.answers.phone,
        quote.answers.email,
        quote.answers.city,
        quote.moduleId,
        quote.status,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(q),
    );
  }

  return NextResponse.json({ leads: quotes.map(toQuotationLead) });
}

export async function PUT(request: Request) {
  const auth = await authorizeRequest(request, { permission: PERMISSIONS.AI_QUOTES });
  const denied = authResultToResponse(auth);
  if (denied) return denied;

  const body = await request.json();
  const quoteId = String(body.id || '').trim();
  const status = body.status as LeadStatus | undefined;
  const adminNotes = body.adminNotes as string | undefined;

  if (!quoteId) {
    return NextResponse.json({ error: 'Quote id is required.' }, { status: 400 });
  }
  if (status && !VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: 'Invalid status.' }, { status: 400 });
  }

  const db = await getDatabase();
  const existing = await getQuoteById(db, quoteId);
  if (!existing) {
    return NextResponse.json({ error: 'Quote not found.' }, { status: 404 });
  }

  const patch: Partial<QuotationQuote> = { updatedAt: new Date().toISOString() };
  if (status) patch.status = status;
  if (adminNotes !== undefined) patch.adminNotes = adminNotes;

  await db.collection('quotation_quotes').updateOne({ id: quoteId }, { $set: patch });
  const updated = await getQuoteById(db, quoteId);
  if (!updated) {
    return NextResponse.json({ error: 'Quote not found.' }, { status: 404 });
  }

  if (status && status !== existing.status) {
    await notifyStatusChanged(updated, existing.status, status);
  }

  return NextResponse.json({ lead: toQuotationLead(updated) });
}
