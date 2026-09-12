/**
 * Phase 1 Interakt ingestion tests (A–L).
 * Run: npx tsx scripts/test-interakt-phase1.ts
 *
 * Requires MongoDB (same env as the app). Uses isolated fixture phones/ids and cleans up.
 */
import { createHmac } from 'crypto';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { v4 as uuidv4 } from 'uuid';
import type { Db } from 'mongodb';
import { getDb } from '../lib/mongodb';
import { generateInteraktSignature, verifyInteraktSignature } from '../lib/interakt/signature';
import { shouldApplyMessageStatus } from '../lib/interakt/status-precedence';
import { processInteraktWebhookEvent } from '../lib/interakt/process-event';
import {
  INTERAKT_CONVERSATIONS_COLLECTION,
  findConversationByPhone,
} from '../lib/interakt/conversation-store';
import {
  INTERAKT_MESSAGES_COLLECTION,
  getMessageByProviderId,
} from '../lib/interakt/message-store';
import {
  INTERAKT_WEBHOOK_EVENTS_COLLECTION,
  insertWebhookEvent,
  getWebhookEventById,
} from '../lib/interakt/webhook-store';
import type { InteraktProviderWebhookBody } from '../lib/interakt/types';

function loadEnvLocal() {
  const envPath = resolve(process.cwd(), '.env.local');
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"'))
      || (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvLocal();
type Result = { id: string; ok: boolean; detail: string };

const results: Result[] = [];
const FIXTURE_TAG = `interakt_p1_${Date.now()}`;
const PHONE_A = '9876500001';
const PHONE_B = '9876500002';
const PHONE_C = '9876500003';
const PHONE_D = '9876500004';
const PHONE_E = '9876500005';
const PHONE_INVALID = '12345';
const BUSINESS_1 = '919999900001';
const BUSINESS_2 = '919999900002';

function pass(id: string, detail: string) {
  results.push({ id, ok: true, detail });
  console.log(`PASS ${id}: ${detail}`);
}

function fail(id: string, detail: string) {
  results.push({ id, ok: false, detail });
  console.error(`FAIL ${id}: ${detail}`);
}

function assert(id: string, condition: boolean, detail: string) {
  if (condition) pass(id, detail);
  else fail(id, detail);
}

function sign(secret: string, body: string): string {
  return generateInteraktSignature(secret, body);
}

function inboundPayload(opts: {
  phone: string;
  messageId: string;
  customerId?: string;
  text?: string;
  timestamp?: string;
}): InteraktProviderWebhookBody {
  return {
    version: '1.0',
    timestamp: opts.timestamp || new Date().toISOString(),
    type: 'message_received',
    data: {
      customer: {
        id: opts.customerId || uuidv4(),
        channel_phone_number: `91${opts.phone}`,
        phone_number: opts.phone,
      },
      message: {
        id: opts.messageId,
        chat_message_type: 'CustomerMessage',
        message_status: 'Sent',
        received_at_utc: opts.timestamp || new Date().toISOString(),
        message_content_type: 'Text',
        message: opts.text || 'hello',
        media_url: null,
      },
    },
  };
}

function statusPayload(opts: {
  type: string;
  phone: string;
  messageId: string;
  customerId?: string;
  deliveredAt?: string | null;
  seenAt?: string | null;
  receivedAt?: string | null;
}): InteraktProviderWebhookBody {
  return {
    version: '1.0',
    timestamp: new Date().toISOString(),
    type: opts.type,
    data: {
      customer: {
        id: opts.customerId || uuidv4(),
        channel_phone_number: `91${opts.phone}`,
        phone_number: opts.phone,
      },
      message: {
        id: opts.messageId,
        chat_message_type: 'PublicApiMessage',
        message_status: opts.type.replace('message_api_', ''),
        received_at_utc: opts.receivedAt || new Date().toISOString(),
        delivered_at_utc: opts.deliveredAt ?? null,
        seen_at_utc: opts.seenAt ?? null,
        message_content_type: 'Template',
        message: '[{"type":"body"}]',
        is_template_message: true,
      },
    },
  };
}

async function acceptAndProcess(
  db: Db,
  payload: InteraktProviderWebhookBody,
  businessWa: string,
) {
  process.env.INTERAKT_BUSINESS_WA_NUMBER = businessWa;
  process.env.INTERAKT_WEBHOOK_SECRET = process.env.INTERAKT_WEBHOOK_SECRET || 'test-secret';
  const rawBody = JSON.stringify(payload);
  const inserted = await insertWebhookEvent(db, {
    rawBody,
    rawPayload: payload,
    signatureValid: true,
  });
  await processInteraktWebhookEvent(db, inserted.event.id);
  return inserted;
}

async function cleanup(db: Db) {
  const phones = [PHONE_A, PHONE_B, PHONE_C, PHONE_D, PHONE_E, `invalid:91${PHONE_INVALID}`];
  await db.collection(INTERAKT_CONVERSATIONS_COLLECTION).deleteMany({
    normalizedPhone: { $in: phones },
  });
  await db.collection(INTERAKT_MESSAGES_COLLECTION).deleteMany({
    normalizedPhone: { $in: phones },
  });
  await db.collection(INTERAKT_WEBHOOK_EVENTS_COLLECTION).deleteMany({
    'rawPayload.data.message.id': { $regex: `^${FIXTURE_TAG}` },
  });
  await db.collection('ops_prospects').deleteMany({ notes: FIXTURE_TAG });
  await db.collection('leads').deleteMany({ notes: FIXTURE_TAG });
}

async function seedProspect(
  db: Db,
  phone: string,
  alternatePhone?: string,
) {
  const id = uuidv4();
  await db.collection('ops_prospects').insertOne({
    id,
    name: `Fixture ${phone}`,
    phone,
    alternatePhone,
    prospectType: 'homeowner',
    source: 'manual',
    callStatus: 'NOT_CALLED',
    phoneInvalid: false,
    notes: FIXTURE_TAG,
    createdBy: 'interakt-test',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  return id;
}

async function seedLead(db: Db, phone: string) {
  const id = uuidv4();
  await db.collection('leads').insertOne({
    id,
    name: `Lead ${phone}`,
    phone,
    notes: FIXTURE_TAG,
    source: 'website',
    status: 'new',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  return id;
}

async function run() {
  // --- Pure unit checks (H signature + status precedence helpers) ---
  const secret = 'examplekey';
  const body = '{"foo":1,"bar":2}';
  const goodSig = sign(secret, body);
  assert('H1', verifyInteraktSignature(secret, body, goodSig), 'valid Interakt-Signature accepted');
  assert(
    'H2',
    !verifyInteraktSignature(secret, body, 'sha256=deadbeef'),
    'invalid Interakt-Signature rejected',
  );
  assert(
    'H3',
    !verifyInteraktSignature(secret, body, null),
    'missing signature rejected',
  );

  assert('G-unit', shouldApplyMessageStatus('delivered', 'sent') === false, 'sent cannot overwrite delivered');
  assert('G-unit2', shouldApplyMessageStatus('sent', 'delivered') === true, 'delivered can overwrite sent');
  assert('G-unit3', shouldApplyMessageStatus('read', 'failed') === false, 'failed cannot overwrite read');

  process.env.INTERAKT_WEBHOOK_SECRET = secret;
  process.env.INTERAKT_BUSINESS_WA_NUMBER = BUSINESS_1;

  const db = (await getDb()) as Db;
  await cleanup(db);

  // A. Unknown number
  {
    const messageId = `${FIXTURE_TAG}_A`;
    await acceptAndProcess(db, inboundPayload({ phone: PHONE_A, messageId }), BUSINESS_1);
    const conv = await findConversationByPhone(db, BUSINESS_1, PHONE_A);
    const msg = await getMessageByProviderId(db, messageId);
    const prospectCount = await db.collection('ops_prospects').countDocuments({ phone: PHONE_A });
    assert(
      'A',
      Boolean(conv && conv.matchStatus === 'unmatched' && msg && prospectCount === 0),
      `unmatched conversation + message, no CRM create (match=${conv?.matchStatus})`,
    );
  }

  // B. Existing prospect
  {
    const prospectId = await seedProspect(db, PHONE_B);
    const messageId = `${FIXTURE_TAG}_B`;
    await acceptAndProcess(db, inboundPayload({ phone: PHONE_B, messageId }), BUSINESS_1);
    const conv = await findConversationByPhone(db, BUSINESS_1, PHONE_B);
    assert(
      'B',
      Boolean(
        conv
        && conv.matchStatus === 'matched'
        && conv.primaryLink?.entityType === 'ops_prospect'
        && conv.primaryLink?.entityId === prospectId,
      ),
      `matched prospect ${prospectId}`,
    );
  }

  // C. Alternate phone
  {
    const prospectId = await seedProspect(db, '9876599999', PHONE_C);
    const messageId = `${FIXTURE_TAG}_C`;
    await acceptAndProcess(db, inboundPayload({ phone: PHONE_C, messageId }), BUSINESS_1);
    const conv = await findConversationByPhone(db, BUSINESS_1, PHONE_C);
    assert(
      'C',
      Boolean(
        conv
        && conv.matchStatus === 'matched'
        && conv.primaryLink?.entityId === prospectId
        && conv.primaryLink?.matchField === 'alternatePhone',
      ),
      'matched via alternatePhone',
    );
  }

  // D. Multiple matching people
  {
    await seedProspect(db, PHONE_D);
    await seedProspect(db, PHONE_D);
    const messageId = `${FIXTURE_TAG}_D`;
    await acceptAndProcess(db, inboundPayload({ phone: PHONE_D, messageId }), BUSINESS_1);
    const conv = await findConversationByPhone(db, BUSINESS_1, PHONE_D);
    assert(
      'D',
      Boolean(
        conv
        && conv.matchStatus === 'ambiguous'
        && conv.primaryLink === null
        && conv.candidateLinks.length >= 2,
      ),
      `ambiguous with ${conv?.candidateLinks.length || 0} candidates`,
    );
  }

  // E. Existing lead
  {
    const leadId = await seedLead(db, PHONE_E);
    const messageId = `${FIXTURE_TAG}_E`;
    await acceptAndProcess(db, inboundPayload({ phone: PHONE_E, messageId }), BUSINESS_1);
    const conv = await findConversationByPhone(db, BUSINESS_1, PHONE_E);
    assert(
      'E',
      Boolean(
        conv
        && conv.matchStatus === 'matched'
        && conv.primaryLink?.entityType === 'ops_lead'
        && conv.primaryLink?.entityId === leadId
        && conv.primaryLink?.source === 'homepage',
      ),
      `matched homepage lead ${leadId}`,
    );
  }

  // F. Duplicate webhook
  {
    const payload = inboundPayload({ phone: PHONE_A, messageId: `${FIXTURE_TAG}_F`, text: 'dup' });
    const rawBody = JSON.stringify(payload);
    process.env.INTERAKT_BUSINESS_WA_NUMBER = BUSINESS_1;
    const first = await insertWebhookEvent(db, { rawBody, rawPayload: payload, signatureValid: true });
    await processInteraktWebhookEvent(db, first.event.id);
    const second = await insertWebhookEvent(db, { rawBody, rawPayload: payload, signatureValid: true });
    const msgCount = await db.collection(INTERAKT_MESSAGES_COLLECTION).countDocuments({
      providerMessageId: `${FIXTURE_TAG}_F`,
    });
    assert(
      'F',
      first.duplicate === false && second.duplicate === true && msgCount === 1,
      'duplicate delivery safe; single message row',
    );
  }

  // G. Out-of-order status
  {
    const messageId = `${FIXTURE_TAG}_G`;
    const customerId = uuidv4();
    await acceptAndProcess(
      db,
      statusPayload({
        type: 'message_api_delivered',
        phone: PHONE_A,
        messageId,
        customerId,
        deliveredAt: '2026-01-02T00:00:00.000Z',
      }),
      BUSINESS_1,
    );
    await acceptAndProcess(
      db,
      statusPayload({
        type: 'message_api_sent',
        phone: PHONE_A,
        messageId,
        customerId,
        receivedAt: '2026-01-01T00:00:00.000Z',
      }),
      BUSINESS_1,
    );
    const msg = await getMessageByProviderId(db, messageId);
    assert(
      'G',
      Boolean(msg && msg.status === 'delivered' && msg.statusTimestamps.deliveredAt),
      `status remained delivered (got ${msg?.status})`,
    );
  }

  // H already covered by unit checks; also ensure forged webhook would not verify
  {
    const forged = createHmac('sha256', 'wrong').update(body).digest('hex');
    assert('H', !verifyInteraktSignature(secret, body, `sha256=${forged}`), 'forged signature rejected');
  }

  // I. Unsupported event
  {
    const payload: InteraktProviderWebhookBody = {
      version: '1.0',
      timestamp: new Date().toISOString(),
      type: 'account_update',
      data: { phone_number: '16505551111', event: 'VERIFIED_ACCOUNT' },
    };
    // Inject message id for cleanup regex
    (payload.data as Record<string, unknown>).message = { id: `${FIXTURE_TAG}_I` };
    const inserted = await acceptAndProcess(db, payload, BUSINESS_1);
    const event = await getWebhookEventById(db, inserted.event.id);
    assert(
      'I',
      event?.processingStatus === 'ignored',
      `unsupported event ignored (${event?.processingStatus})`,
    );
  }

  // J. Invalid phone
  {
    const messageId = `${FIXTURE_TAG}_J`;
    const payload: InteraktProviderWebhookBody = {
      version: '1.0',
      timestamp: new Date().toISOString(),
      type: 'message_received',
      data: {
        customer: {
          id: uuidv4(),
          channel_phone_number: `91${PHONE_INVALID}`,
        },
        message: {
          id: messageId,
          chat_message_type: 'CustomerMessage',
          message_content_type: 'Text',
          message: 'bad phone',
          received_at_utc: new Date().toISOString(),
        },
      },
    };
    await acceptAndProcess(db, payload, BUSINESS_1);
    const conv = await findConversationByPhone(db, BUSINESS_1, `invalid:91${PHONE_INVALID}`);
    const msg = await getMessageByProviderId(db, messageId);
    const createdProspects = await db.collection('ops_prospects').countDocuments({
      phone: { $regex: PHONE_INVALID },
      notes: FIXTURE_TAG,
    });
    assert(
      'J',
      Boolean(msg && conv && conv.matchStatus === 'unmatched' && createdProspects === 0),
      'invalid phone stored unmatched without CRM create',
    );
  }

  // K. Provider message ID duplicate (same id, different event wrappers → second is new event but same message)
  {
    const messageId = `${FIXTURE_TAG}_K`;
    await acceptAndProcess(db, inboundPayload({ phone: PHONE_A, messageId, text: 'first' }), BUSINESS_1);
    // Different timestamp/body → different webhook event key, same provider message id
    await acceptAndProcess(
      db,
      inboundPayload({
        phone: PHONE_A,
        messageId,
        text: 'first',
        timestamp: '2026-09-12T01:00:00.000Z',
      }),
      BUSINESS_1,
    );
    const count = await db.collection(INTERAKT_MESSAGES_COLLECTION).countDocuments({
      providerMessageId: messageId,
    });
    assert('K', count === 1, 'provider message id remains unique');
  }

  // L. Same customer phone, two business WA numbers → two conversations
  {
    const messageId1 = `${FIXTURE_TAG}_L1`;
    const messageId2 = `${FIXTURE_TAG}_L2`;
    const customerId = uuidv4();
    await acceptAndProcess(
      db,
      inboundPayload({ phone: PHONE_A, messageId: messageId1, customerId }),
      BUSINESS_1,
    );
    await acceptAndProcess(
      db,
      inboundPayload({ phone: PHONE_A, messageId: messageId2, customerId }),
      BUSINESS_2,
    );
    const c1 = await findConversationByPhone(db, BUSINESS_1, PHONE_A);
    const c2 = await findConversationByPhone(db, BUSINESS_2, PHONE_A);
    assert(
      'L',
      Boolean(c1 && c2 && c1.id !== c2.id),
      'separate conversations per business WA number',
    );
  }

  await cleanup(db);

  const failed = results.filter((r) => !r.ok);
  console.log('\n--- Summary ---');
  console.log(`Passed: ${results.filter((r) => r.ok).length}/${results.length}`);
  if (failed.length) {
    for (const f of failed) console.error(` - ${f.id}: ${f.detail}`);
    process.exit(1);
  }
  console.log('Phase 1 Interakt tests A–L passed.');
  process.exit(0);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
