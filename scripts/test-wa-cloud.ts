import assert from 'node:assert/strict';
import { signXHubBody, verifyXHubSignature256 } from '../lib/whatsapp-cloud/signature';
import { classifyWhatsAppError } from '../lib/whatsapp-cloud/errors';
import { isStopKeyword } from '../lib/whatsapp-cloud/consent';
import { acceptCloudWebhook, processCloudWebhookEvent } from '../lib/whatsapp-cloud/process-event';
import { createMemoryDb } from './lib/memory-db';

process.env.META_APP_SECRET = '';
assert.equal(verifyXHubSignature256('{}', 'sha256=abcd'), false, 'missing secret fails closed');

process.env.META_APP_SECRET = 'app-secret';
const body = JSON.stringify({ hello: 'world' });
const good = signXHubBody(body, 'app-secret');
assert.equal(verifyXHubSignature256(body, good, 'app-secret'), true);
assert.equal(verifyXHubSignature256(body, 'sha256=deadbeef', 'app-secret'), false);
assert.equal(isStopKeyword(' STOP '), true);
assert.equal(isStopKeyword('hello'), false);

assert.equal(classifyWhatsAppError(131047).kind, 'needs_template');
assert.equal(classifyWhatsAppError(131026).kind, 'retryable');
assert.equal(classifyWhatsAppError(131026).retryable, true);
assert.equal(classifyWhatsAppError(131049).kind, 'rate_limit');
assert.equal(classifyWhatsAppError(131049).retryable, true);
assert.equal(classifyWhatsAppError(130472).retryable, true);
assert.equal(classifyWhatsAppError(131050).kind, 'permanent');
assert.equal(classifyWhatsAppError(131050).retryable, false);
assert.equal(classifyWhatsAppError(131021).kind, 'undeliverable');
assert.equal(classifyWhatsAppError(131056).retryable, true);
assert.equal(classifyWhatsAppError(132001).kind, 'template');
assert.equal(classifyWhatsAppError(131031).pauseSends, true);

async function main() {
process.env.WHATSAPP_VERIFY_TOKEN = 'verify-me';
const { GET } = await import('../app/api/webhooks/whatsapp/route');
const ok = await GET(new Request('https://craftsquare.co.in/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=verify-me&hub.challenge=12345'));
assert.equal(ok.status, 200);
assert.equal(await ok.text(), '12345');
const denied = await GET(new Request('https://craftsquare.co.in/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=nope&hub.challenge=12345'));
assert.equal(denied.status, 403);

const db = createMemoryDb();
await db.collection('ops_follow_up_jobs').insertOne({
  id: 'job1',
  normalizedPhone: '9876543210',
  status: 'queued',
  scheduledFor: new Date().toISOString(),
});

const textPayload = {
  object: 'whatsapp_business_account',
  entry: [{
    changes: [{
      field: 'messages',
      value: {
        messages: [{
          from: '919876543210',
          id: 'wamid.IN.1',
          timestamp: String(Math.floor(Date.now() / 1000)),
          type: 'text',
          text: { body: 'STOP' },
        }],
      },
    }],
  }],
};
const raw = JSON.stringify(textPayload);
const accepted = await acceptCloudWebhook(db as never, raw, textPayload);
assert.equal(accepted.eventIds.length, 1);
await processCloudWebhookEvent(db as never, accepted.eventIds[0]);
const contact = await db.collection('wa_contacts').findOne({ waId: '919876543210' });
assert.equal(contact?.optIn, false);
const job = await db.collection('ops_follow_up_jobs').findOne({ id: 'job1' });
assert.equal(job?.status, 'cancelled');

const statusPayload = {
  entry: [{
    changes: [{
      field: 'messages',
      value: {
        statuses: [{
          id: 'wamid.OUT.1',
          status: 'failed',
          timestamp: String(Math.floor(Date.now() / 1000)),
          recipient_id: '919876543210',
          errors: [{ code: 131047, title: 'Re-engagement required' }],
        }],
      },
    }],
  }],
};
await db.collection('wa_messages').insertOne({
  id: 'm1',
  providerMessageId: 'wamid.OUT.1',
  conversationId: 'c1',
  status: 'sent',
  direction: 'outbound',
  statusTimestamps: {},
  rawMessage: {},
});
const statusAccepted = await acceptCloudWebhook(db as never, JSON.stringify(statusPayload), statusPayload);
await processCloudWebhookEvent(db as never, statusAccepted.eventIds[0]);
const updated = await db.collection('wa_messages').findOne({ providerMessageId: 'wamid.OUT.1' });
assert.equal(updated?.status, 'failed');

const imagePayload = {
  entry: [{
    changes: [{
      field: 'messages',
      value: {
        messages: [{
          from: '919876543210',
          id: 'wamid.IMG.1',
          timestamp: String(Math.floor(Date.now() / 1000)),
          type: 'image',
          image: { id: 'media-1', mime_type: 'image/jpeg', caption: 'plan' },
        }],
      },
    }],
  }],
};
const imageAccepted = await acceptCloudWebhook(db as never, JSON.stringify(imagePayload), imagePayload);
await processCloudWebhookEvent(db as never, imageAccepted.eventIds[0]);
const image = await db.collection('wa_messages').findOne({ providerMessageId: 'wamid.IMG.1' });
assert.equal(image?.messageType, 'image');

const templatePayload = {
  entry: [{
    changes: [{
      field: 'message_template_status_update',
      value: {
        event: 'APPROVED',
        message_template_id: 99,
        message_template_name: 'lead_welcome',
        message_template_language: 'en',
      },
    }],
  }],
};
const templateAccepted = await acceptCloudWebhook(db as never, JSON.stringify(templatePayload), templatePayload);
await processCloudWebhookEvent(db as never, templateAccepted.eventIds[0]);
const template = await db.collection('wa_templates').findOne({ name: 'lead_welcome' });
assert.equal(template?.status, 'APPROVED');

const duplicate = await acceptCloudWebhook(db as never, JSON.stringify(textPayload), textPayload);
assert.equal(duplicate.duplicate, true);

console.log('test:wa-cloud ok');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
