import { NextResponse } from 'next/server';
import { createQuotationPdf } from '@/lib/estimate/pdf';
import { getDatabase, getQuoteById, updateQuote } from '@/lib/estimate/store';

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    const db = await getDatabase();
    const quote = await getQuoteById(db, params.id);
    if (!quote) return NextResponse.json({ error: 'Quote not found' }, { status: 404 });

    const pdf = createQuotationPdf(quote);
    const pdfPath = `quotation-pdfs/${quote.quoteNumber}.pdf`;

    await updateQuote(db, params.id, { pdfStored: true, pdfPath });

    return new NextResponse(pdf, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${quote.quoteNumber}.pdf"`,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'PDF generation failed' }, { status: 500 });
  }
}
