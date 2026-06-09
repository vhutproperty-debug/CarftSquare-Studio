import { NextResponse } from 'next/server';
import { generateConsultantReply, generateSummaryNarrative, getWelcomeMessage } from '@/lib/estimate/ai-consultant';
import {
  getNextQuestion,
  isConversationComplete,
  resolveActiveModule,
  resolvePropertyPurpose,
} from '@/lib/estimate/modules/registry';
import { applyPropertyPurposeAnswer } from '@/lib/estimate/modules/qualification';
import { calculateQuotation } from '@/lib/estimate/pricing-engine';
import { estimateChatSchema } from '@/lib/estimate/schemas';
import { getDatabase, getModulePricing, ensureQuotationIndexes, seedDefaultPricing } from '@/lib/estimate/store';
import type { ConversationMessage, EstimateAnswers, EstimateModuleId } from '@/lib/estimate/types';

function normalizeAnswers(entryModuleId: EstimateModuleId, answers: EstimateAnswers, userMessage?: string): EstimateAnswers {
  if (!userMessage) return answers;
  if (answers.propertyPurpose && String(answers.propertyPurpose).length > 0) return answers;
  const isPurposeReply =
    userMessage.includes('Own Residence') ||
    userMessage.includes('Rental Income') ||
    userMessage.includes('live here') ||
    userMessage.includes('furnish it for Rental');
  if (isPurposeReply) return applyPropertyPurposeAnswer(answers, userMessage);
  return answers;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = estimateChatSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { moduleId: entryModuleId, conversation, userMessage, phase, leadSource, campaignName, landingPage } = parsed.data;
    let answers = normalizeAnswers(entryModuleId as EstimateModuleId, parsed.data.answers, userMessage);

    const activeModuleId = resolveActiveModule(entryModuleId as EstimateModuleId, answers);
    const propertyPurpose = resolvePropertyPurpose(entryModuleId as EstimateModuleId, answers);

    const db = await getDatabase();
    await ensureQuotationIndexes(db);
    await seedDefaultPricing(db);
    const config = await getModulePricing(db, activeModuleId);
    const now = new Date().toISOString();
    const history: ConversationMessage[] = [...conversation];

    if (history.length === 0) {
      history.push({ role: 'assistant', content: getWelcomeMessage(entryModuleId as EstimateModuleId), timestamp: now });
    }

    if (userMessage) {
      history.push({ role: 'user', content: userMessage, timestamp: now });
    }

    const complete = isConversationComplete(entryModuleId as EstimateModuleId, answers);
    const nextQuestion = getNextQuestion(entryModuleId as EstimateModuleId, answers);

    if (phase === 'summary' || complete) {
      const pricing = calculateQuotation(activeModuleId, answers, config);
      if (propertyPurpose) pricing.aiSummary.propertyPurpose = propertyPurpose;
      const summaryText = await generateSummaryNarrative(pricing.aiSummary);
      history.push({ role: 'assistant', content: summaryText, timestamp: new Date().toISOString() });
      return NextResponse.json({
        phase: 'summary',
        complete: true,
        conversation: history,
        summary: pricing.aiSummary,
        nextQuestion: null,
        activeModuleId,
        propertyPurpose,
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
      activeModuleId,
      propertyPurpose,
      leadSource,
      campaignName,
      landingPage,
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Chat failed' }, { status: 500 });
  }
}
