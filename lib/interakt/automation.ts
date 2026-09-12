/**
 * Idempotent automation hooks for Interakt inbound events.
 * Does NOT create CRM persons/leads. Only appends audit/activity when linked.
 */
import type { Db } from 'mongodb';
import type { InteraktConversation, InteraktMessage } from '@/lib/interakt/types';
import { createSupplyActivity } from '@/lib/ops/supply/activity-store';
import { createDemandActivity } from '@/lib/ops/demand/activity-store';
import type { OpsLeadSource } from '@/lib/ops/leads/types';

const AUTOMATION_ACTOR = {
  id: 'system:interakt',
  email: 'interakt@system.local',
  name: 'Interakt WhatsApp',
};

export async function runInboundMessageAutomations(
  db: Db,
  input: {
    conversation: InteraktConversation;
    message: InteraktMessage;
    messageCreated: boolean;
  },
): Promise<void> {
  if (!input.messageCreated) return;

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
        source: 'interakt',
        conversationId: input.conversation.id,
        providerMessageId: input.message.providerMessageId,
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
        source: 'interakt',
        conversationId: input.conversation.id,
        providerMessageId: input.message.providerMessageId,
      },
      actorId: AUTOMATION_ACTOR.id,
      actorEmail: AUTOMATION_ACTOR.email,
      actorName: AUTOMATION_ACTOR.name,
    });
  }

  // ops_prospect: no dedicated prospect activity collection; inbound remains on Interakt thread.
}
