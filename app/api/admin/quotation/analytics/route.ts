import { NextResponse } from 'next/server';
import { requireAdminFromRequest } from '@/lib/auth/require-admin-api';
import { getDatabase } from '@/lib/estimate/store';
import type { QuotationQuote } from '@/lib/estimate/types';

export async function GET(request: Request) {
  const admin = await requireAdminFromRequest(request);
  if (!admin) return NextResponse.json({ error: 'Admin authentication required.' }, { status: 401 });

  const db = await getDatabase();
  const quotes = (await db
    .collection('quotation_quotes')
    .find({}, { projection: { _id: 0 } })
    .toArray()) as QuotationQuote[];

  const total = quotes.length;
  const won = quotes.filter((q) => q.status === 'won').length;
  const avgBudget =
    total > 0
      ? Math.round(quotes.reduce((sum, q) => sum + (q.pricing.estimateLow + q.pricing.estimateHigh) / 2, 0) / total)
      : 0;

  const byModule = quotes.reduce<Record<string, number>>((acc, q) => {
    acc[q.moduleId] = (acc[q.moduleId] || 0) + 1;
    return acc;
  }, {});

  const byCity = quotes.reduce<Record<string, number>>((acc, q) => {
    const city = String(q.answers.city || 'Unknown');
    acc[city] = (acc[city] || 0) + 1;
    return acc;
  }, {});

  const byLanding = quotes.reduce<Record<string, number>>((acc, q) => {
    acc[q.landingPage || '/estimate'] = (acc[q.landingPage || '/estimate'] || 0) + 1;
    return acc;
  }, {});

  const monthly = quotes.reduce<Record<string, number>>((acc, q) => {
    const month = q.createdAt.slice(0, 7);
    acc[month] = (acc[month] || 0) + 1;
    return acc;
  }, {});

  const byPropertyPurpose = quotes.reduce<Record<string, number>>((acc, q) => {
    const purpose = q.propertyPurpose || q.aiSummary?.propertyPurpose || 'Unknown';
    acc[purpose] = (acc[purpose] || 0) + 1;
    return acc;
  }, {});

  return NextResponse.json({
    totalQuotations: total,
    conversionRate: total ? Math.round((won / total) * 100) : 0,
    averageBudget: avgBudget,
    byModule,
    byCity,
    byLanding,
    monthly,
    interiorLeads: byModule['home-interior'] || 0,
    rentalLeads: byModule['rental-furnishing'] || 0,
    kitchenLeads: byModule['modular-kitchen'] || 0,
    wardrobeLeads: byModule['wardrobe'] || 0,
    byPropertyPurpose,
    ownResidenceLeads: byPropertyPurpose['Own Residence'] || 0,
    rentalFurnishingLeads: byPropertyPurpose['Rental Furnishing'] || 0,
  });
}
