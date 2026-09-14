import type { Db } from 'mongodb';
import {
  claimDueFollowUpJobs,
  markFollowUpFailed,
  markFollowUpSucceeded,
} from '@/lib/ops/followups/store';
import { sendInteraktTemplate } from '@/lib/interakt/client';
import { findConversationByPhone } from '@/lib/interakt/conversation-store';
import { upsertInteraktMessage } from '@/lib/interakt/message-store';
import { touchConversationMessageMeta } from '@/lib/interakt/conversation-store';
import { getInteraktBusinessWaNumber } from '@/lib/interakt/phone';
import { maskPhoneForLog } from '@/lib/interakt/phone';

export async function processDueFollowUpJobs(
  db: Db,
  limit = 10,
): Promise<{ processed: number; succeeded: number; failed: number }> {
  const claimed = await claimDueFollowUpJobs(db, limit);
  let succeeded = 0;
  let failed = 0;
  const businessWa = getInteraktBusinessWaNumber();

  for (const job of claimed) {
    try {
      const result = await sendInteraktTemplate({
        countryCode: '+91',
        phoneNumber: job.normalizedPhone,
        callbackData: `followup:${job.id}`,
        template: {
          name: job.templateName,
          languageCode: job.languageCode,
          bodyValues: job.bodyValues,
        },
      });

      if (!result.id) {
        throw new Error('Interakt follow-up send returned no message id.');
      }

      let conversationId = job.conversationId;
      if (!conversationId && businessWa) {
        const existing = await findConversationByPhone(db, businessWa, job.normalizedPhone);
        conversationId = existing?.id;
      }

      if (conversationId) {
        const now = new Date().toISOString();
        await upsertInteraktMessage(db, {
          conversationId,
          providerMessageId: result.id,
          providerCustomerId: null,
          direction: 'outbound',
          messageType: 'Template',
          bodyText: `Follow-up template:${job.templateName}`,
          status: 'sent',
          statusTimestamps: { sentAt: now },
          failure: null,
          callbackData: `followup:${job.id}`,
          normalizedPhone: job.normalizedPhone,
          businessWaNumber: businessWa,
          rawMessage: {
            id: result.id,
            message_content_type: 'Template',
            is_template_message: true,
            message_status: 'Sent',
          },
          rawEventType: 'ops_followup_send',
        });
        await touchConversationMessageMeta(db, conversationId, {
          at: now,
          direction: 'outbound',
        });
      }

      await markFollowUpSucceeded(db, job.id, result.id);
      succeeded += 1;
      console.info(
        '[ops-followups] job_succeeded',
        JSON.stringify({
          jobId: job.id,
          providerMessageId: result.id,
          phone: maskPhoneForLog(job.normalizedPhone),
        }),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'followup_failed';
      await markFollowUpFailed(db, job, message);
      failed += 1;
      console.error(
        '[ops-followups] job_failed',
        JSON.stringify({
          jobId: job.id,
          attempt: job.attempt,
          error: message,
          phone: maskPhoneForLog(job.normalizedPhone),
        }),
      );
    }
  }

  return { processed: claimed.length, succeeded, failed };
}
