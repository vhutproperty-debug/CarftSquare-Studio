import type { ConversationMessage, EstimateAnswers, EstimateModuleId, ProjectSummary } from './types';
import { WELCOME_MESSAGES } from './defaults';
import type { QuestionDef } from './modules/interior';

function fallbackReply(question: QuestionDef | null, answers: EstimateAnswers): string {
  if (!question) {
    return "Wonderful — I have a clear picture of your project. Let me prepare your personalised summary.";
  }
  const prior = Object.keys(answers).length;
  if (prior === 0) return question.text;
  return `Thank you. ${question.text}`;
}

export async function generateConsultantReply(params: {
  moduleId: EstimateModuleId;
  answers: EstimateAnswers;
  nextQuestion: QuestionDef | null;
  conversation: ConversationMessage[];
  summary?: ProjectSummary | null;
}): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY || process.env.AI_API_KEY;
  if (!apiKey) return fallbackReply(params.nextQuestion, params.answers);

  const system = `You are a senior interior design consultant at Craft Square Studio, Mumbai.
Speak warmly, professionally and concisely — like a luxury design consultant.
Ask only ONE question at a time. Never mention pricing, costs, calculations or formulas.
Never invent prices. Recommendations are design-focused only.
Keep responses under 80 words unless summarising a project.`;

  const userPayload = params.summary
    ? `Summarise this project elegantly and ask if they would like to generate their quotation:\n${JSON.stringify(params.summary)}`
    : params.nextQuestion
      ? `Previous answers: ${JSON.stringify(params.answers)}\nNext question to ask naturally: ${params.nextQuestion.text}`
      : `Acknowledge answers: ${JSON.stringify(params.answers)}`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        temperature: 0.7,
        max_tokens: 220,
        messages: [
          { role: 'system', content: system },
          ...params.conversation.slice(-6).map((m) => ({ role: m.role, content: m.content })),
          { role: 'user', content: userPayload },
        ],
      }),
    });

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content?.trim();
    if (content) return content;
  } catch {
    // fall through
  }
  return fallbackReply(params.nextQuestion, params.answers);
}

export function getWelcomeMessage(moduleId: EstimateModuleId): string {
  return WELCOME_MESSAGES[moduleId];
}

export async function generateSummaryNarrative(summary: ProjectSummary): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY || process.env.AI_API_KEY;
  const purposeLine = summary.propertyPurpose ? `\n• **Property Purpose:** ${summary.propertyPurpose}` : '';
  const base = `**Project Summary**${purposeLine}\n\n• **Project Type:** ${summary.projectType}\n• **Area:** ${summary.area}\n• **Lifestyle:** ${summary.lifestyle}\n• **Budget:** ${summary.budget}\n• **Priority:** ${summary.priority}\n• **Package:** ${summary.packageRecommendation}\n• **Style:** ${summary.styleRecommendation}\n• **Materials:** ${summary.materialRecommendation}\n• **Timeline:** ${summary.timeline}\n\nWould you like to generate your quotation?`;

  if (!apiKey) return base;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        temperature: 0.6,
        max_tokens: 350,
        messages: [
          {
            role: 'system',
            content: 'You are a luxury interior consultant. Present a polished project summary. No pricing. End by asking if they would like to generate their quotation.',
          },
          { role: 'user', content: JSON.stringify(summary) },
        ],
      }),
    });
    const data = await response.json();
    return data?.choices?.[0]?.message?.content?.trim() || base;
  } catch {
    return base;
  }
}
