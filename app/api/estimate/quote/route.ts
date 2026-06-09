import { NextResponse } from 'next/server';
import { calculateQuotation } from '@/lib/estimate/pricing-engine';
import { resolveActiveModule, resolvePropertyPurpose } from '@/lib/estimate/modules/registry';
import { estimateLeadSchema } from '@/lib/estimate/schemas';
import {
  createQuoteRecord,
  ensureQuotationIndexes,
  getDatabase,
  getModulePricing,
  seedDefaultPricing,
} from '@/lib/estimate/store';
import type { EstimateModuleId } from '@/lib/estimate/types';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = estimateLeadSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const data = parsed.data;
    const entryModuleId = data.moduleId as EstimateModuleId;
    const activeModuleId = resolveActiveModule(entryModuleId, data.answers);
    const propertyPurpose = resolvePropertyPurpose(entryModuleId, data.answers);

    const db = await getDatabase();
    await ensureQuotationIndexes(db);
    await seedDefaultPricing(db);
    const config = await getModulePricing(db, activeModuleId);
    const pricing = calculateQuotation(activeModuleId, data.answers, config);
    if (propertyPurpose) pricing.aiSummary.propertyPurpose = propertyPurpose;

    const quote = await createQuoteRecord(db, {
      moduleId: activeModuleId,
      propertyPurpose,
      leadSource: data.leadSource,
      campaignName: data.campaignName,
      landingPage: data.landingPage,
      answers: data.answers,
      conversation: data.conversation,
      aiSummary: pricing.aiSummary,
      pricing,
      adjustmentHistory: [],
      customer: {
        name: data.name,
        phone: data.phone,
        whatsapp: data.whatsapp || data.phone,
        email: data.email || '',
      },
    });

    return NextResponse.json({ quote }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Quote generation failed' }, { status: 500 });
  }
}
