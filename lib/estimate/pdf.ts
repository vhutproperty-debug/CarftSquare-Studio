import type { QuotationQuote } from './types';
import { DISCLAIMER } from './defaults';
// @ts-expect-error JS module
import { BRAND } from '@/lib/brand';

function escapePdfText(value = ''): string {
  return String(value).replace(/[₹]/g, 'Rs.').replace(/[\\()]/g, '\\$&').replace(/[\r\n]+/g, ' ');
}

export function buildQuotationPdfLines(quote: QuotationQuote): string[] {
  const c = quote.customer;
  return [
    `Quote ID: ${quote.quoteNumber}`,
    `Customer: ${c?.name || 'Valued Client'}`,
    `Date: ${new Date(quote.createdAt).toLocaleDateString('en-IN')}`,
    `Module: ${quote.moduleId}`,
    `Property Purpose: ${quote.propertyPurpose || quote.aiSummary.propertyPurpose || 'Not specified'}`,
    `Estimate: ${quote.pricing.formattedRange}`,
    `Timeline: ${quote.pricing.timelineWeeks}`,
    `Package: ${quote.pricing.packageName}`,
    `Materials: ${quote.pricing.materialRecommendation}`,
    `Style: ${quote.pricing.styleRecommendation}`,
    `Add-ons: ${quote.pricing.recommendedAddons.join(', ') || 'As scoped'}`,
    `Summary: ${quote.aiSummary.projectType} | ${quote.aiSummary.area}`,
    `Disclaimer: ${DISCLAIMER}`,
  ];
}

export function createQuotationPdf(quote: QuotationQuote): Buffer {
  const lines = buildQuotationPdfLines(quote);
  const content = [
    'BT',
    '/F1 18 Tf',
    '50 790 Td',
    `(${escapePdfText(`${BRAND.name} — AI Quotation`)}) Tj`,
    '/F1 10 Tf',
    '0 -22 Td',
    `(${escapePdfText('Premium Interior Design & Solutions, Mumbai')}) Tj`,
    ...lines.flatMap((line) => ['0 -16 Td', `(${escapePdfText(line)}) Tj`]),
    'ET',
  ].join('\n');

  const objects: string[] = [];
  objects.push('1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj');
  objects.push('2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj');
  objects.push(
    '3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>endobj',
  );
  objects.push(`4 0 obj<< /Length ${content.length} >>stream\n${content}\nendstream endobj`);
  objects.push('5 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj');

  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  for (const obj of objects) {
    offsets.push(pdf.length);
    pdf += `${obj}\n`;
  }
  const xrefStart = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (let i = 1; i < offsets.length; i += 1) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  return Buffer.from(pdf, 'utf8');
}
