import { NextResponse } from 'next/server';
import { getDatabase, getQuoteById } from '@/lib/estimate/store';

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    const db = await getDatabase();
    const quote = await getQuoteById(db, params.id);
    if (!quote) return NextResponse.json({ error: 'Quote not found' }, { status: 404 });
    return NextResponse.json({ quote });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to load quote' }, { status: 500 });
  }
}
