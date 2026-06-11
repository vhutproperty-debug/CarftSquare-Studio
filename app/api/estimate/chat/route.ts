import { NextResponse } from 'next/server';
import {
  generateConsultantReply,
  generateFollowUpReply,
  getWelcomeMessage,
} from '@/lib/estimate/ai-consultant';
import { getProjectCategory } from '@/lib/estimate/consultant/categories';
import {
  applyPricingDefaults,
  extractAnswersFromMessage,
  getNextConsultQuestion,
  isConsultComplete,
} from '@/lib/estimate/consultant';
import { calculateLeadScore, extractTimeline } from '@/lib/estimate/lead-score';
import { resolveActiveModule, resolvePropertyPurpose } from '@/lib/estimate/modules/registry';
import { calculateQuotation } from '@/lib/estimate/pricing-engine';
import { estimateChatSchema } from '@/lib/estimate/schemas';
import {
  getDatabase,
  ensureQuotationIndexes,
  getModulePricing,
  saveConsultationDraft,
  seedDefaultPricing,
} from '@/lib/estimate/store';
import type { ConversationMessage, EstimateAnswers, EstimateModuleId } from '@/lib/estimate/types';

const LEAD_TRANSITION_MESSAGE =
  "Wonderful — I have a clear picture of your project. Please share your contact details below and I'll generate your personalised interior estimate and design recommendations.";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = estimateChatSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { moduleId: entryModuleId, conversation, userMessage, phase, leadSource, campaignName, landingPage } = parsed.data;
    const activeFieldId = parsed.data.activeFieldId as string | undefined;

    let answers: EstimateAnswers = { ...parsed.data.answers };

    if (userMessage) {
      const nextQ = getNextConsultQuestion(entryModuleId as EstimateModuleId, answers);
      answers = await extractAnswersFromMessage(
        userMessage,
        entryModuleId as EstimateModuleId,
        answers,
        activeFieldId || nextQ?.id,
        nextQ?.options,
      );
    }

    const activeModuleId = resolveActiveModule(entryModuleId as EstimateModuleId, answers);
    const propertyPurpose = resolvePropertyPurpose(entryModuleId as EstimateModuleId, answers);

    const db = await getDatabase();
    await ensureQuotationIndexes(db);
    await seedDefaultPricing(db);

    const now = new Date().toISOString();
    const history: ConversationMessage[] = [...conversation];

    if (history.length === 0) {
      history.push({ role: 'assistant', content: getWelcomeMessage(entryModuleId as EstimateModuleId), timestamp: now });
    }

    if (userMessage) {
      history.push({ role: 'user', content: userMessage, timestamp: now });
    }

    if (phase === 'followup' && userMessage) {
      const enrichedAnswers = applyPricingDefaults(answers, activeModuleId);
      const followUp = await generateFollowUpReply(history, enrichedAnswers, userMessage);
      history.push({ role: 'assistant', content: followUp, timestamp: new Date().toISOString() });
      return NextResponse.json({
        phase: 'followup',
        complete: true,
        conversation: history,
        summary: null,
        pricing: null,
        answers: enrichedAnswers,
        nextQuestion: null,
        activeModuleId,
        propertyPurpose,
        leadSource,
        campaignName,
        landingPage,
      });
    }

    const complete = isConsultComplete(entryModuleId as EstimateModuleId, answers);
    const nextQuestion = getNextConsultQuestion(entryModuleId as EstimateModuleId, answers);

    if (complete) {
      history.push({ role: 'assistant', content: LEAD_TRANSITION_MESSAGE, timestamp: new Date().toISOString() });

      const enrichedAnswers = applyPricingDefaults(answers, activeModuleId);
      const config = await getModulePricing(db, activeModuleId);
      const pricing = calculateQuotation(activeModuleId, enrichedAnswers, config);
      if (propertyPurpose) pricing.aiSummary.propertyPurpose = propertyPurpose;

      const projectCategory = getProjectCategory(enrichedAnswers, entryModuleId as EstimateModuleId);
      const timeline = extractTimeline(enrichedAnswers);
      const leadScore = calculateLeadScore(enrichedAnswers, history);

      const consultation = await saveConsultationDraft(db, {
        moduleId: activeModuleId,
        entryModuleId: entryModuleId as EstimateModuleId,
        projectCategory,
        answers: enrichedAnswers,
        conversation: history,
        aiSummary: pricing.aiSummary,
        leadScore,
        timeline,
        leadSource: leadSource || 'ai-estimate',
        campaignName: campaignName || '',
        landingPage: landingPage || '/estimate',
      });

      return NextResponse.json({
        phase: 'lead',
        complete: true,
        conversation: history,
        summary: pricing.aiSummary,
        pricing: null,
        answers: enrichedAnswers,
        nextQuestion: null,
        activeModuleId,
        propertyPurpose,
        projectCategory,
        timeline,
        leadScore,
        consultationId: consultation.id,
        leadSource,
        campaignName,
        landingPage,
      });
    }

    const reply = await generateConsultantReply({
      moduleId: activeModuleId,
      answers,
      nextQuestion,
      conversation: history,
    });

    history.push({ role: 'assistant', content: reply, timestamp: new Date().toISOString() });

    return NextResponse.json({
      phase: 'discovery',
      complete: false,
      conversation: history,
      nextQuestion,
      summary: null,
      pricing: null,
      answers,
      activeModuleId,
      propertyPurpose,
      leadSource,
      campaignName,
      landingPage,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Chat failed. Please try again.' },
      { status: 500 },
    );
  }
}
