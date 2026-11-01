/**
 * Owner outreach: import dedupe, WhatsApp button replies, opt-out, template variables.
 * Does not send WhatsApp messages. Credentials are cleared before any webhook processing.
 *
 * Run: yarn test:owner-outreach
 */
import assert from 'node:assert/strict';

delete process.env.WHATSAPP_ACCESS_TOKEN;
delete process.env.WHATSAPP_PHONE_NUMBER_ID;
delete process.env.META_SYSTEM_USER_TOKEN;
process.env.WHATSAPP_ENABLED = 'false';

import { isStopKeyword } from '../lib/whatsapp-cloud/consent';
import { extractInboundMessageContent } from '../lib/whatsapp-cloud/inbound-content';
import { acceptCloudWebhook, processCloudWebhookEvent } from '../lib/whatsapp-cloud/process-event';
import { recipientTemplateBodyValues } from '../lib/whatsapp-cloud/delivery/submit';
import {
  commitProspectImport,
  parseProspectImportDocument,
  planProspectImport,
} from '../lib/ops/calls/import-prospects';
import { createProspect } from '../lib/ops/calls/prospect-store';
import { mapOwnerReply } from '../lib/ops/calls/prospect-replies';
import { normalizeOutreachPhone } from '../lib/ops/outreach-phone';
import { renderProspectBodyValues } from '../lib/ops/campaigns/prospect-variables';
import {
  materializeProspectAudience,
  previewProspectAudience,
} from '../lib/ops/campaigns/prospect-audience';
import { createCampaign } from '../lib/ops/campaigns/store';
import { createMemoryDb } from './lib/memory-db';

function webhook(from: string, id: string, message: Record<string, unknown>) {
  return {
    entry: [{
      changes: [{
        field: 'messages',
        value: {
          messages: [{
            from,
            id,
            timestamp: '1710000000',
            ...message,
          }],
        },
      }],
    }],
  };
}

async function main() {
  assert.equal(normalizeOutreachPhone('9820330203')?.phone, '9820330203');
  assert.equal(normalizeOutreachPhone('+91 98203 30203')?.phone, '9820330203');
  assert.equal(normalizeOutreachPhone('919820330203')?.kind, 'indian');
  const singapore = normalizeOutreachPhone('+6591461314');
  assert.equal(singapore?.kind, 'international');
  assert.equal(singapore?.phone, '+6591461314');
  assert.notEqual(singapore?.phone, '6591461314');
  assert.equal(normalizeOutreachPhone('+971566013470')?.phone, '+971566013470');
  assert.equal(normalizeOutreachPhone('+61456096900')?.waDigits, '61456096900');
  assert.equal(normalizeOutreachPhone('12345'), null);

  const csv = [
    'name,phone,prospectType,projectName,priority,wave,salutation,unit,unitCount,campaignTag,source,batch',
    'Shweta,9820330203,homeowner,72 West,P1,1,Shweta,"506, 3105",2,72west-owner-outreach-2026,csv_import,wave-1',
    'Duplicate,+919820330203,homeowner,72 West,P2,2,Other,100,1,72west-owner-outreach-2026,csv_import,wave-1',
    'Anupam,+6591461314,homeowner,72 West,Intl,4,Anupam,2101,1,72west-owner-outreach-2026,csv_import,intl',
    'Bad,12345,homeowner,72 West,P4,4,Nope,,,72west-owner-outreach-2026,csv_import,',
  ].join('\n');
  const rows = parseProspectImportDocument(csv, 'owners.csv');
  const planned = planProspectImport(rows);
  assert.equal(planned.plan.summary.creates, 2);
  assert.equal(planned.plan.summary.updates, 0);
  assert.equal(planned.plan.summary.skips, 2);
  assert.equal(planned.plan.rows[0].action, 'create');
  assert.equal(planned.plan.rows[0].phone, '9820330203');
  assert.equal(planned.plan.rows[1].reason, 'duplicate_in_file');
  assert.equal(planned.plan.rows[2].phone, '+6591461314');
  assert.equal(planned.plan.rows[3].reason, 'invalid_phone');

  const db = createMemoryDb();
  const committed = await commitProspectImport(db as never, rows, [], 'admin-1');
  assert.equal(committed.summary.creates, 2);
  const stored = await db.collection('ops_prospects').find({}).toArray();
  assert.equal(stored.length, 2);
  const shweta = stored.find((row) => row.phone === '9820330203');
  assert.equal(shweta?.salutation, 'Shweta');
  assert.equal(shweta?.priority, 'P1');
  assert.equal(shweta?.wave, 1);
  assert.equal(shweta?.batch, 'wave-1');
  assert.equal(shweta?.unitCount, 2);
  assert.equal(shweta?.campaignTag, '72west-owner-outreach-2026');
  assert.equal(shweta?.callStatus, 'NOT_CALLED');
  assert.equal(stored.some((row) => row.phone === '+6591461314'), true);
  assert.equal(stored.some((row) => row.phone === '6591461314'), false);

  await db.collection('ops_prospects').updateOne(
    { phone: '9820330203' },
    { $set: { callStatus: 'INTERESTED', optOut: true, doNotContact: true } },
  );
  const existing = await db.collection('ops_prospects').find({}).toArray();
  const again = await commitProspectImport(db as never, [{
    name: 'Shweta Mishrikotkar',
    phone: '09820330203',
    prospectType: 'homeowner',
    projectName: '72 West',
    priority: 'P1',
    wave: 1,
    salutation: 'Shweta',
    unit: '506, 3105',
    source: 'csv_import',
  }], existing as never, 'admin-1');
  assert.equal(again.summary.updates, 1);
  assert.equal(again.summary.creates, 0);
  const updated = await db.collection('ops_prospects').findOne({ phone: '9820330203' });
  assert.equal(updated?.name, 'Shweta Mishrikotkar');
  assert.equal(updated?.callStatus, 'INTERESTED');
  assert.equal(updated?.optOut, true);
  assert.equal(updated?.doNotContact, true);
  const stillTwo = await db.collection('ops_prospects').countDocuments({});
  assert.equal(stillTwo, 2);

  assert.equal(extractInboundMessageContent({
    type: 'button',
    button: { text: 'Sell', payload: 'Sell' },
  }).text, 'Sell');
  assert.equal(extractInboundMessageContent({
    type: 'interactive',
    interactive: { type: 'button_reply', button_reply: { id: 'rent', title: 'Rent out' } },
  }).text, 'Rent out');
  assert.equal(extractInboundMessageContent({
    type: 'interactive',
    interactive: { type: 'list_reply', list_reply: { id: 'interiors', title: 'Interiors' } },
  }).text, 'Interiors');
  assert.equal(extractInboundMessageContent({
    type: 'button',
    button: { payload: 'Not now' },
  }).text, 'Not now');
  assert.equal(extractInboundMessageContent({ type: 'text', text: { body: '' } }).text, null);

  assert.equal(isStopKeyword('STOP'), true);
  assert.equal(isStopKeyword('UNSUBSCRIBE'), true);
  assert.equal(isStopKeyword('Stop messages'), true);
  assert.equal(isStopKeyword('stop message'), true);
  assert.equal(isStopKeyword('please stop'), false);
  assert.deepEqual(mapOwnerReply('Sell'), { kind: 'intent', intent: 'sell', callStatus: 'INTERESTED', label: 'Sell' });
  assert.deepEqual(mapOwnerReply('Not now')?.kind, 'intent');
  assert.equal(mapOwnerReply('Stop messages')?.kind, 'opt_out');

  const sell = webhook('919820330203', 'wamid.BTN.SELL', {
    type: 'button',
    button: { text: 'Sell', payload: 'Sell' },
  });
  const sellAccepted = await acceptCloudWebhook(db as never, JSON.stringify(sell), sell);
  await processCloudWebhookEvent(db as never, sellAccepted.eventIds[0]);
  const sellMessage = await db.collection('wa_messages').findOne({ providerMessageId: 'wamid.BTN.SELL' });
  assert.equal(sellMessage?.bodyText, 'Sell');
  const sellProspect = await db.collection('ops_prospects').findOne({ phone: '9820330203' });
  assert.equal(sellProspect?.intent, 'sell');
  assert.equal(sellProspect?.lastButtonReply, 'Sell');
  assert.equal(sellProspect?.callStatus, 'DO_NOT_CALL');
  assert.equal(sellProspect?.optOut, true);

  const fresh = await createProspect(db as never, {
    name: 'Rohit Sharma',
    phone: '9820504417',
    prospectType: 'homeowner',
    projectName: '72 West',
    unit: '1705, 1706',
    salutation: 'Nitin',
    priority: 'P1',
    wave: 1,
    source: 'csv_import',
    createdBy: 'admin-1',
  });
  const rent = webhook('919820504417', 'wamid.BTN.RENT', {
    type: 'interactive',
    interactive: { type: 'button_reply', button_reply: { id: 'rent_out', title: 'Rent out' } },
  });
  const rentAccepted = await acceptCloudWebhook(db as never, JSON.stringify(rent), rent);
  await processCloudWebhookEvent(db as never, rentAccepted.eventIds[0]);
  const rentMessage = await db.collection('wa_messages').findOne({ providerMessageId: 'wamid.BTN.RENT' });
  assert.equal(rentMessage?.bodyText, 'Rent out');
  const rentProspect = await db.collection('ops_prospects').findOne({ id: fresh.id });
  assert.equal(rentProspect?.intent, 'rent');
  assert.equal(rentProspect?.callStatus, 'INTERESTED');

  const interiors = webhook('6591461314', 'wamid.BTN.INT', {
    type: 'interactive',
    interactive: { type: 'list_reply', list_reply: { id: 'interiors', title: 'Interiors' } },
  });
  const interiorsAccepted = await acceptCloudWebhook(db as never, JSON.stringify(interiors), interiors);
  await processCloudWebhookEvent(db as never, interiorsAccepted.eventIds[0]);
  const intlProspect = await db.collection('ops_prospects').findOne({ phone: '+6591461314' });
  assert.equal(intlProspect?.intent, 'interiors');
  assert.equal(intlProspect?.callStatus, 'INTERESTED');
  assert.equal(intlProspect?.lastButtonReply, 'Interiors');

  const notNow = webhook('6591461314', 'wamid.BTN.LATER', {
    type: 'button',
    button: { text: 'Not now', payload: 'Not now' },
  });
  const notNowAccepted = await acceptCloudWebhook(db as never, JSON.stringify(notNow), notNow);
  await processCloudWebhookEvent(db as never, notNowAccepted.eventIds[0]);
  const later = await db.collection('ops_prospects').findOne({ phone: '+6591461314' });
  assert.equal(later?.intent, 'not_now');
  assert.equal(later?.callStatus, 'FOLLOW_UP');

  const stop = webhook('6591461314', 'wamid.BTN.STOP', {
    type: 'button',
    button: { text: 'Stop messages', payload: 'Stop messages' },
  });
  const stopAccepted = await acceptCloudWebhook(db as never, JSON.stringify(stop), stop);
  await processCloudWebhookEvent(db as never, stopAccepted.eventIds[0]);
  const stopped = await db.collection('ops_prospects').findOne({ phone: '+6591461314' });
  assert.equal(stopped?.optOut, true);
  assert.equal(stopped?.doNotContact, true);
  assert.equal(stopped?.callStatus, 'DO_NOT_CALL');
  assert.equal(stopped?.lastButtonReply, 'Stop messages');
  const contact = await db.collection('wa_contacts').findOne({ waId: '6591461314' });
  assert.equal(contact?.optIn, false);
  const stopMessage = await db.collection('wa_messages').findOne({ providerMessageId: 'wamid.BTN.STOP' });
  assert.equal(stopMessage?.bodyText, 'Stop messages');

  const textStop = webhook('919820504417', 'wamid.TEXT.STOP', {
    type: 'text',
    text: { body: 'UNSUBSCRIBE' },
  });
  const textAccepted = await acceptCloudWebhook(db as never, JSON.stringify(textStop), textStop);
  await processCloudWebhookEvent(db as never, textAccepted.eventIds[0]);
  const unsubscribed = await db.collection('ops_prospects').findOne({ phone: '9820504417' });
  assert.equal(unsubscribed?.optOut, true);
  assert.equal(unsubscribed?.doNotContact, true);

  assert.deepEqual(renderProspectBodyValues({
    salutation: 'Shweta',
    unit: '506, 3105',
    unitCount: 2,
  }), ['Shweta', '506 & 3105']);
  assert.deepEqual(renderProspectBodyValues({
    name: 'Liquordom Exports Pvt Ltd',
    salutation: 'Team',
    unit: '',
    unitCount: 0,
  }), ['Team', 'your flat']);
  assert.deepEqual(
    renderProspectBodyValues({ name: 'Vishesh Trilokinath Nangia', unit: '1901 / 2601' }, ['salutation']),
    ['Vishesh'],
  );

  const audienceDb = createMemoryDb();
  await createProspect(audienceDb as never, {
    name: 'Shweta Mishrikotkar',
    phone: '9820330203',
    prospectType: 'homeowner',
    projectName: '72 West',
    unit: '506, 3105',
    salutation: 'Shweta',
    priority: 'P1',
    wave: 1,
    batch: 'wave-1',
    campaignTag: '72west-owner-outreach-2026',
    source: 'csv_import',
    createdBy: 'admin-1',
  });
  await createProspect(audienceDb as never, {
    name: 'Opted Out',
    phone: '9820334181',
    prospectType: 'homeowner',
    projectName: '72 West',
    unit: '605',
    salutation: 'Team',
    priority: 'P1',
    wave: 1,
    source: 'csv_import',
    optOut: true,
    doNotContact: true,
    callStatus: 'DO_NOT_CALL',
    createdBy: 'admin-1',
  });
  await createProspect(audienceDb as never, {
    name: 'Other wave',
    phone: '9167110505',
    prospectType: 'homeowner',
    projectName: '72 West',
    unit: '902, 903',
    salutation: 'Komal',
    priority: 'P2',
    wave: 2,
    source: 'csv_import',
    createdBy: 'admin-1',
  });
  await createProspect(audienceDb as never, {
    name: 'Other project',
    phone: '9892338290',
    prospectType: 'homeowner',
    projectName: 'Auris',
    salutation: 'Rajiv',
    priority: 'P1',
    wave: 1,
    source: 'csv_import',
    createdBy: 'admin-1',
  });

  const preview = await previewProspectAudience(audienceDb as never, {
    projectName: '72 West',
    wave: 1,
    priority: 'P1',
  });
  assert.equal(preview.total, 2);
  assert.equal(preview.queued, 1);
  assert.equal(preview.skipped, 1);
  const queued = preview.recipients.find((row) => row.status === 'queued');
  const skipped = preview.recipients.find((row) => row.status === 'skipped_opt_out');
  assert.deepEqual(queued?.bodyValues, ['Shweta', '506 & 3105']);
  assert.equal(skipped?.reason, 'opt_out');

  const campaign = await createCampaign(audienceDb as never, {
    name: '72 West wave 1',
    templateName: 'cs_72west_owner_outreach',
    languageCode: 'en',
    bodyValues: ['fallback', 'fallback unit'],
    audience: {
      source: 'ops_prospects',
      projectName: '72 West',
      wave: 1,
      priority: 'P1',
      variableFields: ['salutation', 'units'],
    },
    throttlePerMinute: 20,
    createdBy: 'admin-1',
  });
  await materializeProspectAudience(audienceDb as never, campaign, {
    projectName: '72 West',
    wave: 1,
    priority: 'P1',
    variableFields: ['salutation', 'units'],
  });
  const recipients = await audienceDb.collection('ops_wa_campaign_recipients').find({ campaignId: campaign.id }).toArray();
  assert.equal(recipients.length, 2);
  const shwetaRecipient = recipients.find((row) => row.normalizedPhone === '9820330203');
  const optedRecipient = recipients.find((row) => row.normalizedPhone === '9820334181');
  assert.equal(shwetaRecipient?.status, 'queued');
  assert.deepEqual(shwetaRecipient?.bodyValues, ['Shweta', '506 & 3105']);
  assert.equal(optedRecipient?.status, 'skipped_opt_out');
  assert.equal(optedRecipient?.doNotContact, true);
  assert.deepEqual(
    recipientTemplateBodyValues(shwetaRecipient as { bodyValues: string[] }, campaign),
    ['Shweta', '506 & 3105'],
  );
  assert.deepEqual(
    recipientTemplateBodyValues({ bodyValues: [] }, { bodyValues: ['Hi', 'flat'] }),
    ['Hi', 'flat'],
  );
  const saved = await audienceDb.collection('ops_wa_campaigns').findOne({ id: campaign.id });
  assert.equal(saved?.stats.queued, 1);
  assert.equal(saved?.stats.skipped, 1);
  assert.equal(saved?.status, 'draft');

  console.log('test:owner-outreach ok');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
