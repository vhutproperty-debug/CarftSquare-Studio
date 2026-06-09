import { NextResponse } from 'next/server';
import { getAdjustmentExplanation, calculateQuotation } from '@/lib/estimate/pricing-engine';
import { estimateAdjustSchema } from '@/lib/estimate/schemas';
import { getDatabase, getModulePricing, getQuoteById, updateQuote } from '@/lib/estimate/store';
import type { EstimateModuleId, QuickAdjustmentAction } from '@/lib/estimate/types';

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const body = await request.json();
    const parsed = estimateAdjustSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const db = await getDatabase();
    const quote = await getQuoteById(db, params.id);
    if (!quote) return NextResponse.json({ error: 'Quote not found' }, { status: 404 });

    const config = await getModulePricing(db, quote.moduleId as EstimateModuleId);
    const action = parsed.data.action as QuickAdjustmentAction;
    const packageOverride =
      action === 'upgrade_premium' ? 'premium' : action === 'upgrade_luxury' ? 'luxury' : undefined;

    const pricing = calculateQuotation(quote.moduleId, quote.answers, config, {
      adjustment: action,
      packageOverride,
    });
    if (quote.propertyPurpose) pricing.aiSummary.propertyPurpose = quote.propertyPurpose;

    const explanation = getAdjustmentExplanation(action);
    const updated = await updateQuote(db, params.id, {
      pricing,
      aiSummary: pricing.aiSummary,
      adjustmentHistory: [
        ...(quote.adjustmentHistory || []),
        { action, explanation, at: new Date().toISOString() },
      ],
    });

    return NextResponse.json({ quote: updated, explanation });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Adjustment failed' }, { status: 500 });
  }
}
