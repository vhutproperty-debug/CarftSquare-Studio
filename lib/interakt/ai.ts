/**
 * AI orchestration over Interakt conversations.
 * Deterministic CRM/identity rules remain authoritative — AI never invents identity or status.
 */
import type { Db } from 'mongodb';
import type { InteraktConversation, InteraktMessage } from '@/lib/interakt/types';

export type InteraktAiInsight = {
  id: string;
  conversationId: string;
  providerMessageId?: string;
  intent: string;
  intentConfidence: number;
  summary: string;
  suggestedNextAction: string;
  extracted: {
    budgetMention?: string | null;
    projectMention?: string | null;
    urgency?: 'low' | 'medium' | 'high' | 'unknown';
  };
  provenance: {
    model: string;
    source: 'rules' | 'openai';
    generatedAt: string;
  };
};

const COLLECTION = 'interakt_ai_insights';

export function classifyWithRules(text: string): Omit<InteraktAiInsight, 'id' | 'conversationId' | 'providerMessageId' | 'provenance'> {
  const lower = text.toLowerCase();
  let intent = 'general';
  let confidence = 0.55;
  let urgency: 'low' | 'medium' | 'high' | 'unknown' = 'unknown';
  let suggestedNextAction = 'Review in Ops WhatsApp Inbox and reply with an approved template if needed.';

  // Opt-out / DNC must win over other keyword matches.
  if (/\b(stop|unsubscribe|opt[-\s]?out)\b|do not (call|message)|wrong number/.test(lower)) {
    intent = 'opt_out';
    confidence = 0.85;
    urgency = 'high';
    suggestedNextAction = 'Mark do-not-contact and cancel pending follow-up jobs.';
  } else if (/\b(rent|rental|tenant|lease)\b/.test(lower)) {
    intent = 'rental_enquiry';
    confidence = 0.75;
    suggestedNextAction = 'Qualify rental budget/BHK and link to demand or supply record.';
  } else if (/\b(buy|sale|purchase|resale)\b/.test(lower)) {
    intent = 'sale_enquiry';
    confidence = 0.75;
    suggestedNextAction = 'Qualify buy/sale intent and assign demand owner.';
  } else if (/\b(interior|kitchen|wardrobe|paint)\b/.test(lower)) {
    intent = 'interior_enquiry';
    confidence = 0.7;
    suggestedNextAction = 'Route to interior/quotation follow-up template.';
  } else if (/\b(visit|site visit|tomorrow|today)\b/.test(lower)) {
    intent = 'site_visit_request';
    confidence = 0.7;
    urgency = 'high';
    suggestedNextAction = 'Schedule call/site visit follow-up job.';
  }

  const budget = lower.match(/(?:budget|upto|under)\s*(?:of\s*)?(₹?\s*[\d,.]+(?:\s*(?:lakh|lac|cr|k))?)/i);
  const project = lower.match(/\b(auris|satellite|oberoi|elysian|serenity|elegance)[\w\s-]*/i);

  return {
    intent,
    intentConfidence: confidence,
    summary: text.slice(0, 240),
    suggestedNextAction,
    extracted: {
      budgetMention: budget?.[1] || null,
      projectMention: project?.[0]?.trim() || null,
      urgency,
    },
  };
}

export async function ensureAiInsightIndexes(db: Db): Promise<void> {
  await db.collection(COLLECTION).createIndex({ id: 1 }, { unique: true });
  await db.collection(COLLECTION).createIndex({ conversationId: 1, 'provenance.generatedAt': -1 });
  await db.collection(COLLECTION).createIndex({ providerMessageId: 1 }, { sparse: true });
}

export async function generateInboundInsight(
  db: Db,
  conversation: InteraktConversation,
  message: InteraktMessage,
): Promise<InteraktAiInsight | null> {
  if (!message.bodyText?.trim()) return null;
  await ensureAiInsightIndexes(db);

  // Prefer deterministic rules. Optional OpenAI enrichment can be added later without changing CRM authority.
  const classified = classifyWithRules(message.bodyText);
  const insight: InteraktAiInsight = {
    id: `${message.providerMessageId || message.id}-insight`,
    conversationId: conversation.id,
    providerMessageId: message.providerMessageId,
    ...classified,
    provenance: {
      model: 'rules-v1',
      source: 'rules',
      generatedAt: new Date().toISOString(),
    },
  };

  await db.collection(COLLECTION).updateOne(
    { id: insight.id },
    { $set: insight },
    { upsert: true },
  );

  await db.collection('interakt_conversations').updateOne(
    { id: conversation.id },
    {
      $set: {
        lastAiInsight: {
          intent: insight.intent,
          intentConfidence: insight.intentConfidence,
          suggestedNextAction: insight.suggestedNextAction,
          generatedAt: insight.provenance.generatedAt,
          source: insight.provenance.source,
        },
        updatedAt: new Date().toISOString(),
      },
    },
  );

  return insight;
}
