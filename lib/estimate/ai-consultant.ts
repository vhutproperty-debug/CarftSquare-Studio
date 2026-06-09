import type { ConversationMessage, EstimateAnswers, EstimateModuleId, PricingResult, ProjectSummary } from './types';
import { WELCOME_MESSAGES } from './defaults';
import type { QuestionDef } from './modules/interior';

function fallbackReply(question: QuestionDef | null, answers: EstimateAnswers): string {
  if (!question) {
    return "Wonderful — I have a clear picture of your project. Let me prepare your personalised recommendations.";
  }
  const prior = Object.keys(answers).filter((k) => answers[k] !== undefined && answers[k] !== '').length;
  if (prior === 0) return question.text;
  return `Thank you. ${question.text}`;
}

function storageAdvice(priority: string): string {
  if (/essential/i.test(priority)) {
    return 'Prioritise floor-to-ceiling wardrobes, loft storage, and multi-functional furniture to maximise every square foot.';
  }
  if (/important/i.test(priority)) {
    return 'Balance aesthetics with smart storage — consider built-in units, bed storage, and concealed cabinetry.';
  }
  if (/moderate/i.test(priority)) {
    return 'Focus storage in high-use zones like bedrooms and kitchen while keeping living areas open and airy.';
  }
  return 'Keep the layout clean and uncluttered with selective storage in wardrobes and kitchen.';
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

  const knownFields = Object.entries(params.answers)
    .filter(([, v]) => v !== undefined && v !== null && String(v).trim() !== '')
    .map(([k, v]) => `${k}: ${v}`)
    .join(', ');

  const system = `You are a senior interior design consultant at Craft Square Studio, Mumbai.
Speak warmly, professionally and concisely — like an experienced luxury interior designer.
Ask only ONE question at a time. Never repeat a question for information already provided.
Acknowledge what you already know from the client before asking the next question.
Never mention specific prices, costs, calculations or formulas. Never invent prices.
Keep responses under 70 words.`;

  const userPayload = params.nextQuestion
    ? `Known project details: ${knownFields || 'none yet'}\nNext information needed: ${params.nextQuestion.text}\nRephrase this as a natural, designer-like question. Do not list multiple questions.`
    : `Acknowledge the project details: ${knownFields}`;

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
        max_tokens: 200,
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

export async function generateRecommendationsNarrative(
  pricing: PricingResult,
  answers: EstimateAnswers,
): Promise<string> {
  const storage = storageAdvice(String(answers.storagePriority || pricing.aiSummary.priority));
  const designTip =
    pricing.recommendedPackage === 'Luxury' || pricing.recommendedPackage === 'Premium'
      ? 'Consider accent lighting, premium veneers, and a cohesive material palette for a refined finish.'
      : 'Optimise modular layouts and durable finishes for everyday comfort and long-term value.';

  const base = `Based on your project, here are my recommendations:

**Estimated Budget Range:** ${pricing.formattedRange}
**Recommended Package:** ${pricing.packageName}
**Interior Style:** ${pricing.styleRecommendation}
**Timeline:** ${pricing.timelineWeeks}
**Storage:** ${storage}
**Design Tip:** ${designTip}

Would you like a Craft Square Studio designer to prepare this project for you?`;

  const apiKey = process.env.OPENAI_API_KEY || process.env.AI_API_KEY;
  if (!apiKey) return base;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        temperature: 0.6,
        max_tokens: 400,
        messages: [
          {
            role: 'system',
            content: `You are a senior interior designer at Craft Square Studio. Present concise, professional recommendations.
Use the EXACT budget range provided — never invent or change prices.
Include: budget range, style, storage advice, timeline, and one design suggestion.
End by asking: "Would you like a Craft Square Studio designer to prepare this project for you?"
Keep under 180 words. Use brief markdown bold for headings.`,
          },
          {
            role: 'user',
            content: JSON.stringify({
              budgetRange: pricing.formattedRange,
              package: pricing.packageName,
              style: pricing.styleRecommendation,
              timeline: pricing.timelineWeeks,
              storageAdvice: storage,
              designTip,
              project: pricing.aiSummary,
            }),
          },
        ],
      }),
    });
    const data = await response.json();
    return data?.choices?.[0]?.message?.content?.trim() || base;
  } catch {
    return base;
  }
}

export async function generateFollowUpReply(
  conversation: ConversationMessage[],
  answers: EstimateAnswers,
  userMessage: string,
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY || process.env.AI_API_KEY;
  const fallback = "Happy to help further. Feel free to ask about layouts, materials, storage ideas, or timelines for your project.";

  if (!apiKey) return fallback;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        temperature: 0.7,
        max_tokens: 250,
        messages: [
          {
            role: 'system',
            content: `You are a senior interior designer at Craft Square Studio. Answer follow-up questions helpfully and concisely.
Never mention specific prices. Project context: ${JSON.stringify(answers)}. Keep under 100 words.`,
          },
          ...conversation.slice(-8).map((m) => ({ role: m.role, content: m.content })),
          { role: 'user', content: userMessage },
        ],
      }),
    });
    const data = await response.json();
    return data?.choices?.[0]?.message?.content?.trim() || fallback;
  } catch {
    return fallback;
  }
}

/** @deprecated Use generateRecommendationsNarrative */
export async function generateSummaryNarrative(summary: ProjectSummary): Promise<string> {
  const purposeLine = summary.propertyPurpose ? `\n• **Property Purpose:** ${summary.propertyPurpose}` : '';
  return `**Project Summary**${purposeLine}\n\n• **Project Type:** ${summary.projectType}\n• **Area:** ${summary.area}\n• **Lifestyle:** ${summary.lifestyle}\n• **Budget:** ${summary.budget}\n• **Priority:** ${summary.priority}\n• **Package:** ${summary.packageRecommendation}\n• **Style:** ${summary.styleRecommendation}\n• **Materials:** ${summary.materialRecommendation}\n• **Timeline:** ${summary.timeline}\n\nWould you like a Craft Square Studio designer to prepare this project for you?`;
}
