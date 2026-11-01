import type { Db } from 'mongodb';
import { getDb } from '@/lib/mongodb';
import { isMetaLeadsEnabled } from '@/lib/meta/config';
import { getLeadAssignees, getOwnerAlertEmails, getOwnerAlertWhatsApp, isWhatsAppEnabled } from '@/lib/whatsapp-cloud/config';
import { isOptedOut, recordOptIn } from '@/lib/whatsapp-cloud/consent';
import { messageIdFromSend, sendTemplate, WhatsAppApiError } from '@/lib/whatsapp-cloud/client';
import { getEmailFromRaw, getResendApiKey } from '@/lib/env/resend';
import { isValidIndianMobile, normalizeIndianMobile } from '@/lib/phone/indian-mobile';
import { toWhatsAppRecipient } from '@/lib/whatsapp-cloud/phone';
import { enqueueFollowUpJob } from '@/lib/ops/followups/store';
import { TEMPLATE_NAMES } from '@/lib/whatsapp-cloud/templates';
import { getSiteUrl } from '@/lib/site';
import {
  findLatestConversationByPhone,
  touchConversationMessageMeta,
  upsertConversationIdentity,
} from '@/lib/whatsapp-cloud/conversation-store';
import { upsertWaMessage } from '@/lib/whatsapp-cloud/message-store';
import { getWaBusinessWaNumber } from '@/lib/whatsapp-cloud/phone';

const ACTIVITY = 'ops_activity_logs';
const SETTINGS = 'ops_settings';
const POINTER_ID = 'lead_round_robin';

export type NewLeadInput = {
  id: string;
  source: string;
  name?: string;
  phone?: string;
  email?: string;
  project?: string;
  campaign?: string;
  collection?: string;
};

export type PipelineResult = {
  duplicate: boolean;
  assignedTo?: string;
  welcomeSent: boolean;
  ownerAlerted: boolean;
  followupsScheduled: boolean;
};

type PipelineState = {
  idempotencyKey: string;
  assignedTo?: string;
  welcomeSent: boolean;
  ownerAlerted: boolean;
  followupsScheduled: boolean;
};

function pipelineKey(lead: NewLeadInput) {
  return `lead:new:${lead.source}:${lead.id}`;
}

function safeText(value: string | undefined, fallback: string) {
  const text = String(value || '').trim();
  return text || fallback;
}

async function loadState(db: Db, key: string): Promise<PipelineState | null> {
  const doc = await db.collection(ACTIVITY).findOne({ idempotencyKey: key });
  if (!doc) return null;
  const details = (doc as { details?: Partial<PipelineState> }).details || {};
  return {
    idempotencyKey: key,
    assignedTo: details.assignedTo,
    welcomeSent: Boolean(details.welcomeSent),
    ownerAlerted: Boolean(details.ownerAlerted),
    followupsScheduled: Boolean(details.followupsScheduled),
  };
}

async function saveState(db: Db, lead: NewLeadInput, state: PipelineState) {
  const now = new Date().toISOString();
  await db.collection(ACTIVITY).updateOne(
    { idempotencyKey: state.idempotencyKey },
    {
      $set: {
        idempotencyKey: state.idempotencyKey,
        action: 'lead_pipeline',
        actorId: 'system:leads',
        actorEmail: 'leads@system.local',
        resource: lead.collection || lead.source,
        resourceId: lead.id,
        details: {
          assignedTo: state.assignedTo || null,
          welcomeSent: state.welcomeSent,
          ownerAlerted: state.ownerAlerted,
          followupsScheduled: state.followupsScheduled,
          source: lead.source,
        },
        updatedAt: now,
      },
      $setOnInsert: { id: state.idempotencyKey, createdAt: now },
    },
    { upsert: true },
  );
}

async function assignRoundRobin(db: Db): Promise<{ id: string; name: string; email?: string } | null> {
  const assignees = getLeadAssignees();
  if (!assignees.length) return null;
  const current = await db.collection(SETTINGS).findOne({ id: POINTER_ID });
  const pointer = Number((current as { pointer?: number } | null)?.pointer || 0);
  const assignee = assignees[pointer % assignees.length];
  await db.collection(SETTINGS).updateOne(
    { id: POINTER_ID },
    { $set: { id: POINTER_ID, pointer: pointer + 1, updatedAt: new Date().toISOString() } },
    { upsert: true },
  );
  return assignee;
}

async function rememberOutbound(
  db: Db,
  input: { phone: string; providerMessageId: string; templateName: string; body: string },
) {
  const normalized = normalizeIndianMobile(input.phone);
  const businessWaNumber = getWaBusinessWaNumber() || 'whatsapp_cloud';
  let conversation = await findLatestConversationByPhone(db, normalized);
  if (!conversation) {
    conversation = await upsertConversationIdentity(db, {
      businessWaNumber,
      normalizedPhone: normalized || toWhatsAppRecipient(input.phone),
      customerWaE164: toWhatsAppRecipient(input.phone),
      providerCustomerId: toWhatsAppRecipient(input.phone),
    });
  }
  const now = new Date().toISOString();
  await upsertWaMessage(db, {
    conversationId: conversation.id,
    providerMessageId: input.providerMessageId,
    providerCustomerId: conversation.providerCustomerId,
    direction: 'outbound',
    messageType: 'template',
    bodyText: input.body,
    status: 'sent',
    statusTimestamps: { sentAt: now },
    failure: null,
    callbackData: null,
    normalizedPhone: conversation.normalizedPhone,
    businessWaNumber: conversation.businessWaNumber,
    rawMessage: {
      id: input.providerMessageId,
      message_content_type: 'template',
      is_template_message: true,
      message: input.body,
      message_status: 'sent',
    },
    rawEventType: 'lead_pipeline',
  });
  await touchConversationMessageMeta(db, conversation.id, { at: now, direction: 'outbound' });
}

async function sendWelcome(db: Db, lead: NewLeadInput): Promise<boolean> {
  if (!isWhatsAppEnabled()) return false;
  const phone = normalizeIndianMobile(lead.phone);
  if (!isValidIndianMobile(phone)) return false;
  if (await isOptedOut(db, phone)) return false;
  await recordOptIn(db, phone, lead.source === 'meta_ads' ? 'lead_form' : lead.source);
  const name = safeText(lead.name, 'there');
  const project = safeText(lead.project || lead.campaign, 'your enquiry');
  try {
    const raw = await sendTemplate(phone, TEMPLATE_NAMES.leadWelcome, 'en', [
      { type: 'body', parameters: [{ type: 'text', text: name }, { type: 'text', text: project }] },
    ]);
    const id = messageIdFromSend(raw);
    if (id) {
      await rememberOutbound(db, {
        phone,
        providerMessageId: id,
        templateName: TEMPLATE_NAMES.leadWelcome,
        body: `Template:${TEMPLATE_NAMES.leadWelcome}`,
      });
    }
    return Boolean(id);
  } catch (error) {
    console.warn('[leads] welcome_failed', error instanceof WhatsAppApiError ? error.message : error);
    return false;
  }
}

async function sendOwnerWhatsApp(lead: NewLeadInput, link: string): Promise<boolean> {
  if (!isWhatsAppEnabled()) return false;
  const recipients = getOwnerAlertWhatsApp();
  if (!recipients.length) return false;
  const name = safeText(lead.name, 'New lead');
  const phone = safeText(lead.phone, 'unknown');
  const source = safeText(lead.source, 'website');
  const campaign = safeText(lead.campaign || lead.project, 'direct');
  let sent = false;
  for (const to of recipients) {
    try {
      const raw = await sendTemplate(to, TEMPLATE_NAMES.ownerNewLeadAlert, 'en', [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: name },
            { type: 'text', text: phone },
            { type: 'text', text: source },
            { type: 'text', text: campaign },
          ],
        },
      ]);
      if (messageIdFromSend(raw)) sent = true;
    } catch (error) {
      console.warn('[leads] owner_wa_failed', error instanceof Error ? error.message : error);
    }
  }
  void link;
  return sent;
}

async function sendOwnerEmail(lead: NewLeadInput, link: string): Promise<boolean> {
  const apiKey = getResendApiKey();
  const from = getEmailFromRaw();
  const recipients = getOwnerAlertEmails();
  if (!apiKey || !from || !recipients.length) return false;
  const name = safeText(lead.name, 'New lead');
  const phone = safeText(lead.phone, '');
  const tel = phone ? phone.replace(/[^\d+]/g, '') : '';
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: recipients,
      subject: `New ${lead.source} lead: ${name}`,
      html: `<p><strong>${name}</strong> just enquired via ${lead.source}.</p>
        <p>Phone: ${tel ? `<a href="tel:${tel}">${phone}</a>` : 'not provided'}</p>
        <p>Campaign: ${safeText(lead.campaign || lead.project, 'direct')}</p>
        <p><a href="${link}">Open in CraftSquare ops</a></p>`,
    }),
  });
  return response.ok;
}

async function scheduleFollowUps(db: Db, lead: NewLeadInput): Promise<boolean> {
  const phone = normalizeIndianMobile(lead.phone);
  if (!isValidIndianMobile(phone)) return false;
  if (await isOptedOut(db, phone)) return false;
  const name = safeText(lead.name, 'there');
  const day = 24 * 60 * 60 * 1000;
  const jobs = [
    { template: TEMPLATE_NAMES.leadFollowupDay1, delay: day, tag: 'day1' },
    { template: TEMPLATE_NAMES.leadFollowupDay3, delay: 3 * day, tag: 'day3' },
  ];
  for (const job of jobs) {
    await enqueueFollowUpJob(db, {
      targetType: 'ops_lead',
      targetId: lead.id,
      targetSource: lead.source,
      phone,
      templateName: job.template,
      languageCode: 'en',
      bodyValues: [name],
      scheduledFor: new Date(Date.now() + job.delay).toISOString(),
      createdBy: 'system:leads',
      idempotencyKey: `lead-followup:${lead.source}:${lead.id}:${job.tag}`,
    });
  }
  return true;
}

export async function onNewLead(lead: NewLeadInput, db?: Db): Promise<PipelineResult> {
  if (!isMetaLeadsEnabled()) {
    return { duplicate: false, welcomeSent: false, ownerAlerted: false, followupsScheduled: false };
  }
  const database = db || await getDb();
  const key = pipelineKey(lead);
  const existing = await loadState(database, key);
  const state: PipelineState = existing || {
    idempotencyKey: key,
    welcomeSent: false,
    ownerAlerted: false,
    followupsScheduled: false,
  };

  if (!state.assignedTo) {
    const assignee = await assignRoundRobin(database);
    if (assignee) {
      state.assignedTo = assignee.id;
      if (lead.collection) {
        await database.collection(lead.collection).updateOne(
          { id: lead.id },
          { $set: { assignedTo: assignee.id, assignedToName: assignee.name, updatedAt: new Date().toISOString() } },
        );
      }
    }
  }

  if (!state.welcomeSent) state.welcomeSent = await sendWelcome(database, lead);
  const link = `${getSiteUrl()}/ops/leads/${lead.source}/${lead.id}`;
  if (!state.ownerAlerted) {
    const wa = await sendOwnerWhatsApp(lead, link);
    const email = await sendOwnerEmail(lead, link);
    state.ownerAlerted = wa || email;
  }
  if (!state.followupsScheduled) state.followupsScheduled = await scheduleFollowUps(database, lead);

  await saveState(database, lead, state);
  const duplicate = Boolean(existing?.welcomeSent && existing.ownerAlerted && existing.followupsScheduled);
  return {
    duplicate,
    assignedTo: state.assignedTo,
    welcomeSent: state.welcomeSent,
    ownerAlerted: state.ownerAlerted,
    followupsScheduled: state.followupsScheduled,
  };
}
