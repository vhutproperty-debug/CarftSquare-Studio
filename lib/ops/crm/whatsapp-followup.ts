/**
 * Deterministic CRM automation helpers that schedule WhatsApp follow-ups.
 * AI suggestions never mutate CRM status — callers decide when to enqueue.
 */
import type { Db } from 'mongodb';
import { enqueueFollowUpJob } from '@/lib/ops/followups/store';
import { getDefaultFollowUpTemplate } from '@/lib/interakt/templates';
import type { FollowUpTargetType } from '@/lib/ops/followups/types';

export async function scheduleCrmWhatsAppFollowUp(
  db: Db,
  input: {
    targetType: FollowUpTargetType;
    targetId: string;
    targetSource?: string;
    phone: string;
    conversationId?: string;
    delayMinutes?: number;
    templateName?: string;
    bodyValues?: string[];
    createdBy: string;
    reason: string;
  },
) {
  const templateName = input.templateName || getDefaultFollowUpTemplate().name;
  const delayMs = Math.max(1, input.delayMinutes ?? 60) * 60_000;
  const scheduledFor = new Date(Date.now() + delayMs).toISOString();
  const idempotencyKey = `crm-followup:${input.targetType}:${input.targetId}:${templateName}:${input.reason}`;

  return enqueueFollowUpJob(db, {
    targetType: input.targetType,
    targetId: input.targetId,
    targetSource: input.targetSource,
    phone: input.phone,
    conversationId: input.conversationId,
    templateName,
    bodyValues: input.bodyValues,
    scheduledFor,
    createdBy: input.createdBy,
    idempotencyKey,
  });
}
