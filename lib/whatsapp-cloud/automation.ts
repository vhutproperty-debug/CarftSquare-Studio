/**
 * Idempotent automation hooks for Wa inbound events.
 * Does NOT create CRM persons/leads. Only appends audit/activity when linked.
 */
import type { Db } from 'mongodb';
import type { WaConversation, WaMessage } from '@/lib/whatsapp-cloud/types';
import { generateInboundInsight } from '@/lib/whatsapp-cloud/ai';
import { createSupplyActivity } from '@/lib/ops/supply/activity-store';
import { createDemandActivity } from '@/lib/ops/demand/activity-store';
import { OPS_FOLLOW_UP_JOBS_COLLECTION } from '@/lib/ops/followups/store';
import type { OpsLeadSource } from '@/lib/ops/leads/types';

const AUTOMATION_ACTOR = {
  id: 'system:whatsapp',
  email: 'whatsapp@system.local',
  name: 'WhatsApp Cloud',
};

async function cancelPendingFollowUpsForPhone(db: Db, normalizedPhone: string): Promise<number> {
  if (!normalizedPhone || normalizedPhone.startsWith('invalid:')) return 0;
  const now = new Date().toISOString();
  const result = await db.collection(OPS_FOLLOW_UP_JOBS_COLLECTION).updateMany(
    {
      normalizedPhone,
      status: { $in: ['queued', 'retrying'] },
    },
    {
      $set: {
        status: 'cancelled',
        lastError: 'Cancelled: inbound reply',
        cancelledAt: now,
        updatedAt: now,
      },
    },
  );
  return result.modifiedCount;
}

export async function runInboundMessageAutomations(
  db: Db,
  input: {
    conversation: WaConversation;
    message: WaMessage;
    messageCreated: boolean;
  },
): Promise<void> {
  if (!input.messageCreated) return;

  let insightIntent: string | null = null;
  try {
    const insight = await generateInboundInsight(db, input.conversation, input.message);
    insightIntent = insight?.intent || null;
  } catch (error) {
    console.error(
      '[wa] ai_insight_failed',
      error instanceof Error ? error.message : error,
    );
  }

  const cancelled = await cancelPendingFollowUpsForPhone(db, input.conversation.normalizedPhone);
  if (cancelled) {
    console.info(
      '[whatsapp] reply_followups_cancelled',
      JSON.stringify({ conversationId: input.conversation.id, cancelled }),
    );
  }

  if (insightIntent === 'opt_out') {
    console.info(
      '[wa] opt_out_followups_cancelled',
      JSON.stringify({
        conversationId: input.conversation.id,
        cancelled,
      }),
    );
    await db.collection('wa_conversations').updateOne(
      { id: input.conversation.id },
      {
        $set: {
          doNotContact: true,
          doNotContactAt: new Date().toISOString(),
          doNotContactReason: 'inbound_opt_out',
          updatedAt: new Date().toISOString(),
        },
      },
    );
  }

  const link = input.conversation.primaryLink;
  if (!link) return;

  const preview = input.message.bodyText
    ? `${input.message.bodyText.slice(0, 80)}${input.message.bodyText.length > 80 ? '…' : ''}`
    : `(${input.message.messageType})`;

  if (link.entityType === 'ops_supply_record') {
    await createSupplyActivity(db, {
      supplyId: link.entityId,
      type: 'NOTE_ADDED',
      message: `WhatsApp inbound: ${preview}`,
      meta: {
        source: 'wa',
        conversationId: input.conversation.id,
        providerMessageId: input.message.providerMessageId,
        intent: insightIntent,
      },
      actorId: AUTOMATION_ACTOR.id,
      actorEmail: AUTOMATION_ACTOR.email,
      actorName: AUTOMATION_ACTOR.name,
    });
    return;
  }

  if (link.entityType === 'ops_lead' && link.source) {
    await createDemandActivity(db, {
      source: link.source as OpsLeadSource,
      sourceId: link.entityId,
      type: 'NOTE_ADDED',
      message: `WhatsApp inbound: ${preview}`,
      meta: {
        source: 'wa',
        conversationId: input.conversation.id,
        providerMessageId: input.message.providerMessageId,
        intent: insightIntent,
      },
      actorId: AUTOMATION_ACTOR.id,
      actorEmail: AUTOMATION_ACTOR.email,
      actorName: AUTOMATION_ACTOR.name,
    });
  }
}
