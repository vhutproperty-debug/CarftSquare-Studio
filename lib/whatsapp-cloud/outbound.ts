import type { Db } from 'mongodb';
import {
  messageIdFromSend,
  sendMedia,
  sendTemplate,
  sendText,
  type TemplateComponent,
} from '@/lib/whatsapp-cloud/client';
import { canSendFreeform, isOptedOut, recordOptIn } from '@/lib/whatsapp-cloud/consent';
import {
  getConversationById,
  touchConversationMessageMeta,
} from '@/lib/whatsapp-cloud/conversation-store';
import { upsertWaMessage } from '@/lib/whatsapp-cloud/message-store';
import { getWaBusinessWaNumber, toWhatsAppRecipient } from '@/lib/whatsapp-cloud/phone';
import { getWhatsAppDefaultLanguage } from '@/lib/whatsapp-cloud/config';

async function persistOutbound(
  db: Db,
  input: {
    conversationId: string;
    providerMessageId: string;
    messageType: string;
    bodyText: string;
    normalizedPhone: string;
    businessWaNumber: string;
    providerCustomerId: string | null;
    callbackData?: string;
    raw: unknown;
  },
) {
  const now = new Date().toISOString();
  const { message } = await upsertWaMessage(db, {
    conversationId: input.conversationId,
    providerMessageId: input.providerMessageId,
    providerCustomerId: input.providerCustomerId,
    direction: 'outbound',
    messageType: input.messageType,
    bodyText: input.bodyText,
    status: 'sent',
    statusTimestamps: { sentAt: now },
    failure: null,
    callbackData: input.callbackData || null,
    normalizedPhone: input.normalizedPhone,
    businessWaNumber: input.businessWaNumber,
    rawMessage: {
      id: input.providerMessageId,
      message_content_type: input.messageType,
      message_status: 'sent',
      message: input.bodyText,
    },
    rawEventType: 'ops_send',
  });
  await touchConversationMessageMeta(db, input.conversationId, { at: now, direction: 'outbound' });
  return message;
}

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
  if (!conversation) throw Object.assign(new Error('Conversation not found.'), { status: 404 });
  const phone = conversation.customerWaE164 || conversation.normalizedPhone;
  if (!phone || phone.startsWith('invalid:')) {
    throw Object.assign(new Error('Conversation phone is invalid.'), { status: 400 });
  }
  if (await isOptedOut(db, phone)) {
    throw Object.assign(new Error('Contact has opted out of WhatsApp.'), { status: 409 });
  }

  const components: TemplateComponent[] = [];
  if (input.headerValues?.length) {
    components.push({
      type: 'header',
      parameters: input.headerValues.map((text) => ({ type: 'text', text })),
    });
  }
  if (input.bodyValues?.length) {
    components.push({
      type: 'body',
      parameters: input.bodyValues.map((text) => ({ type: 'text', text })),
    });
  }
  const raw = await sendTemplate(phone, input.templateName, input.languageCode, components);
  const id = messageIdFromSend(raw);
  if (!id) throw Object.assign(new Error('WhatsApp Cloud API returned no message id.'), { status: 502 });

  const message = await persistOutbound(db, {
    conversationId: conversation.id,
    providerMessageId: id,
    messageType: 'template',
    bodyText: `Template:${input.templateName}`,
    normalizedPhone: conversation.normalizedPhone,
    businessWaNumber: conversation.businessWaNumber || getWaBusinessWaNumber(),
    providerCustomerId: conversation.providerCustomerId,
    callbackData: input.callbackData,
    raw,
  });
  return { conversation, message, providerMessageId: id };
}

export async function sendSessionTextToConversation(
  db: Db,
  input: { conversationId: string; body: string },
) {
  const conversation = await getConversationById(db, input.conversationId);
  if (!conversation) throw Object.assign(new Error('Conversation not found.'), { status: 404 });
  const phone = conversation.customerWaE164 || conversation.normalizedPhone;
  if (!phone || phone.startsWith('invalid:')) {
    throw Object.assign(new Error('Conversation phone is invalid.'), { status: 400 });
  }
  const open = await canSendFreeform(db, phone);
  if (!open) {
    throw Object.assign(
      new Error('The 24-hour window is closed. Send an approved template instead.'),
      { status: 409, code: 'needs_template' },
    );
  }
  const raw = await sendText(phone, input.body);
  const id = messageIdFromSend(raw);
  if (!id) throw Object.assign(new Error('WhatsApp Cloud API returned no message id.'), { status: 502 });
  const message = await persistOutbound(db, {
    conversationId: conversation.id,
    providerMessageId: id,
    messageType: 'text',
    bodyText: input.body,
    normalizedPhone: conversation.normalizedPhone,
    businessWaNumber: conversation.businessWaNumber || getWaBusinessWaNumber(),
    providerCustomerId: conversation.providerCustomerId,
    raw,
  });
  return { conversation, message, providerMessageId: id };
}

export async function sendMediaToConversation(
  db: Db,
  input: {
    conversationId: string;
    type: 'image' | 'document' | 'video' | 'audio';
    id?: string;
    link?: string;
    caption?: string;
    filename?: string;
  },
) {
  const conversation = await getConversationById(db, input.conversationId);
  if (!conversation) throw Object.assign(new Error('Conversation not found.'), { status: 404 });
  const phone = conversation.customerWaE164 || conversation.normalizedPhone;
  if (!(await canSendFreeform(db, phone))) {
    throw Object.assign(
      new Error('Media outside the 24-hour window requires a template.'),
      { status: 409, code: 'needs_template' },
    );
  }
  const raw = await sendMedia(phone, input.type, input);
  const id = messageIdFromSend(raw);
  if (!id) throw Object.assign(new Error('WhatsApp Cloud API returned no message id.'), { status: 502 });
  const message = await persistOutbound(db, {
    conversationId: conversation.id,
    providerMessageId: id,
    messageType: input.type,
    bodyText: input.caption || `(${input.type})`,
    normalizedPhone: conversation.normalizedPhone,
    businessWaNumber: conversation.businessWaNumber || getWaBusinessWaNumber(),
    providerCustomerId: conversation.providerCustomerId,
    raw,
  });
  return { conversation, message, providerMessageId: id, recipient: toWhatsAppRecipient(phone) };
}

export function defaultTemplateLanguage() {
  return getWhatsAppDefaultLanguage();
}

export async function markLeadOptIn(db: Db, phone: string) {
  await recordOptIn(db, phone, 'lead_form');
}
