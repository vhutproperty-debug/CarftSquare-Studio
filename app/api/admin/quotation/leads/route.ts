import { NextResponse } from 'next/server';
import { requireAdminFromRequest } from '@/lib/auth/require-admin-api';
import { getDatabase, toQuotationLead } from '@/lib/estimate/store';
import type { QuotationQuote } from '@/lib/estimate/types';

export async function GET(request: Request) {
  const admin = await requireAdminFromRequest(request);
  if (!admin) return NextResponse.json({ error: 'Admin authentication required.' }, { status: 401 });

  const db = await getDatabase();
  const quotes = (await db
    .collection('quotation_quotes')
    .find({}, { projection: { _id: 0 } })
    .sort({ createdAt: -1 })
    .limit(200)
    .toArray()) as QuotationQuote[];

  return NextResponse.json({ leads: quotes.map(toQuotationLead) });
}

export async function PUT(request: Request) {
  const admin = await requireAdminFromRequest(request);
  if (!admin) return NextResponse.json({ error: 'Admin authentication required.' }, { status: 401 });

  const body = await request.json();
  const { id, status } = body;
  if (!id || !status) return NextResponse.json({ error: 'id and status required' }, { status: 400 });

  const db = await getDatabase();
  await db.collection('quotation_quotes').updateOne(
    { id },
    { $set: { status, updatedAt: new Date().toISOString() } },
  );
  return NextResponse.json({ message: 'Lead updated.' });
}
