import { NextResponse } from 'next/server';
import { getProjectCategory } from '@/lib/estimate/consultant/categories';
import { applyPricingDefaults, validateConsultationAnswers, isValidIndianPhone } from '@/lib/estimate/consultant';
import { notifyEnquiryCreated } from '@/lib/estimate/integrations';
import { calculateLeadScore, extractTimeline } from '@/lib/estimate/lead-score';
import { calculateQuotation } from '@/lib/estimate/pricing-engine';
import { resolveActiveModule, resolvePropertyPurpose } from '@/lib/estimate/modules/registry';
import { estimateLeadSchema } from '@/lib/estimate/schemas';
import {
  createQuoteRecord,
  ensureQuotationIndexes,
  findRecentQuoteByPhone,
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

    if (!isValidIndianPhone(data.phone)) {
      return NextResponse.json({ error: 'Please enter a valid 10-digit mobile number.' }, { status: 400 });
    }

    const entryModuleId = data.moduleId as EstimateModuleId;
    const validation = validateConsultationAnswers(entryModuleId, data.answers);
    if (!validation.ready) {
      return NextResponse.json(
        { error: `Missing project details: ${validation.missing.join(', ')}` },
        { status: 400 },
      );
    }

    const db = await getDatabase();
    await ensureQuotationIndexes(db);
    await seedDefaultPricing(db);

    const duplicate = await findRecentQuoteByPhone(db, data.phone, 30);
    if (duplicate) {
      return NextResponse.json(
        { quote: duplicate, duplicate: true, message: 'Your estimate was already generated recently.' },
        { status: 200 },
      );
    }

    const activeModuleId = resolveActiveModule(entryModuleId, data.answers);
    const propertyPurpose = resolvePropertyPurpose(entryModuleId, data.answers);
    const enrichedAnswers = applyPricingDefaults(data.answers, activeModuleId);
    const config = await getModulePricing(db, activeModuleId);
    const pricing = calculateQuotation(activeModuleId, enrichedAnswers, config);
    if (propertyPurpose) pricing.aiSummary.propertyPurpose = propertyPurpose;

    const customer = {
      name: data.name,
      phone: data.phone,
      whatsapp: data.whatsapp || data.phone,
      email: data.email || '',
    };
    const projectCategory = getProjectCategory(enrichedAnswers, entryModuleId);
    const timeline = extractTimeline(enrichedAnswers);
    const leadScore = calculateLeadScore(enrichedAnswers, data.conversation, customer);

    const quote = await createQuoteRecord(db, {
      moduleId: activeModuleId,
      propertyPurpose,
      leadSource: data.leadSource,
      campaignName: data.campaignName,
      landingPage: data.landingPage,
      answers: enrichedAnswers,
      conversation: data.conversation,
      aiSummary: pricing.aiSummary,
      pricing,
      adjustmentHistory: [],
      notes: '',
      leadScore,
      projectCategory,
      timeline,
      consultationId: data.consultationId,
      customer,
    });

    await notifyEnquiryCreated(quote);

    return NextResponse.json({ quote }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Quote generation failed. Please try again.' },
      { status: 500 },
    );
  }
}
