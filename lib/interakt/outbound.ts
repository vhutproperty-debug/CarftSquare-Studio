import type { Db } from 'mongodb';
import { sendInteraktTemplate } from '@/lib/interakt/client';
import {
  getConversationById,
  touchConversationMessageMeta,
} from '@/lib/interakt/conversation-store';
import { upsertInteraktMessage } from '@/lib/interakt/message-store';
import { getInteraktBusinessWaNumber } from '@/lib/interakt/phone';

/**
 * Send an approved Interakt template into an existing conversation and persist outbound row.
 * Free-form session text is not available on Interakt public API (Template-only).
 */
export async function sendTemplateToConversation(
  db: Db,
  input: {
    conversationId: string;
    templateName: string;
    languageCode?: string;
    bodyValues?: string[];
    headerValues?: string[];
    callbackData?: string;
  },
) {
  const conversation = await getConversationById(db, input.conversationId);
  if (!conversation) {
    throw Object.assign(new Error('Conversation not found.'), { status: 404 });
  }

  const businessWa = getInteraktBusinessWaNumber();
  if (businessWa && conversation.businessWaNumber !== businessWa) {
    throw Object.assign(new Error('Conversation business number mismatch.'), { status: 409 });
  }

  const phone = conversation.normalizedPhone;
  if (!phone || phone.startsWith('invalid:')) {
    throw Object.assign(new Error('Conversation phone is invalid.'), { status: 400 });
  }

  const result = await sendInteraktTemplate({
    countryCode: '+91',
    phoneNumber: phone,
    callbackData: input.callbackData || `conversation:${conversation.id}`,
    template: {
      name: input.templateName,
      languageCode: input.languageCode || 'en',
      bodyValues: input.bodyValues,
      headerValues: input.headerValues,
    },
  });

  if (!result.id) {
    throw Object.assign(new Error('Interakt did not return a message id.'), { status: 502 });
  }

  const now = new Date().toISOString();
  const { message } = await upsertInteraktMessage(db, {
    conversationId: conversation.id,
    providerMessageId: result.id,
    providerCustomerId: conversation.providerCustomerId,
    direction: 'outbound',
    messageType: 'Template',
    bodyText: `Template:${input.templateName}`,
    status: 'sent',
    statusTimestamps: { sentAt: now },
    failure: null,
    callbackData: input.callbackData || `conversation:${conversation.id}`,
    normalizedPhone: conversation.normalizedPhone,
    businessWaNumber: conversation.businessWaNumber,
    rawMessage: {
      id: result.id,
      message_content_type: 'Template',
      message_status: 'Sent',
      is_template_message: true,
      message: JSON.stringify({ template: input.templateName, bodyValues: input.bodyValues || [] }),
    },
    rawEventType: 'ops_template_send',
  });

  await touchConversationMessageMeta(db, conversation.id, {
    at: now,
    direction: 'outbound',
  });

  return { conversation, message, providerMessageId: result.id };
}
