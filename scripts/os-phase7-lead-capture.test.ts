/**
 * Phase 7 lead capture. Idempotent inbox events. No writes to unrelated rows.
 * Run: npx tsx scripts/os-phase7-lead-capture.test.ts
 */
import assert from 'node:assert/strict';
import { buildInbox, withCapturedLeads } from '../lib/ops/crm/inbox';
import { extractLeadgenNotices, extractWhatsAppEnquiries, leadsRetrievalGranted } from '../lib/ops/growth/capture/parse';
import {
  captureGrowthLead,
  captureMetaNotice,
  captureWhatsAppEnquiries,
  fetchMetaLeadIntoInbox,
  listGrowthCaptures,
} from '../lib/ops/growth/capture/store';
import { createMemoryDb } from './lib/memory-db';

async function main() {
  const notices = extractLeadgenNotices({
    entry: [{ id: 'page', changes: [{ field: 'leadgen', value: { leadgen_id: 'lead-1', form_id: 'form-9', ad_id: 'ad-3' } }] }],
  });
  assert.equal(notices[0].leadgenId, 'lead-1');
  const messages = extractWhatsAppEnquiries({
    entry: [{ changes: [{ value: { contacts: [{ wa_id: '919811111111', profile: { name: 'Asha' } }], messages: [{ id: 'wamid.1', from: '919811111111', type: 'text', text: { body: '2 BHK Andheri' }, timestamp: '1700000000' }] } }] }],
  });
  assert.equal(messages[0].name, 'Asha');
  assert.equal(leadsRetrievalGranted(['ads_read']), false);

  const db = createMemoryDb();
  await db.collection('contacts').insertOne({ id: 'contact-1', phones: ['9811111111'], name: 'Keep me' });
  const first = await captureMetaNotice(db as never, notices[0], {
    name: 'Asha',
    phone: '9811111111',
    campaignId: 'camp-1',
    status: 'new',
    fieldData: { budget: '1 Cr' },
  });
  assert.equal(first.created, true);
  assert.equal(first.event.answers.budget, '1 Cr');
  const again = await captureMetaNotice(db as never, notices[0], {
    name: 'Other',
    phone: '9000000000',
    status: 'new',
    fieldData: { budget: 'changed' },
  });
  assert.equal(again.created, false);
  assert.equal(again.event.phone, '9811111111');
  assert.equal(again.event.answers.budget, '1 Cr');
  const contact = await db.collection('contacts').findOne({ id: 'contact-1' });
  assert.equal(contact?.name, 'Keep me');

  const blocked = await captureWhatsAppEnquiries(db as never, {
    entry: [{ changes: [{ value: { messages: [{ id: 'wamid.9', from: '919800000000', type: 'text', text: { body: 'hi' } }] } }] }],
  }, true);
  assert.equal(blocked.restricted, true);
  assert.equal(blocked.accepted, 0);

  const allowed = await captureWhatsAppEnquiries(db as never, {
    entry: [{ changes: [{ value: { messages: [{ id: 'wamid.9', from: '919800000000', type: 'text', text: { body: 'hi' } }] } }] }],
  }, false);
  assert.equal(allowed.accepted, 1);
  const repeat = await captureWhatsAppEnquiries(db as never, {
    entry: [{ changes: [{ value: { messages: [{ id: 'wamid.9', from: '919800000000', type: 'text', text: { body: 'hi again' } }] } }] }],
  }, false);
  assert.equal(repeat.accepted, 0);

  let fetched = 0;
  const waiting = await fetchMetaLeadIntoInbox(db as never, {
    leadgenId: 'lead-2',
    permissions: ['ads_management'],
    fetchLead: async () => {
      fetched += 1;
      return { ok: true, name: 'Should not run' };
    },
  });
  assert.equal(fetched, 0);
  assert.equal(waiting.event.status, 'awaiting_permission');
  assert.deepEqual(waiting.event.answers, {});

  const rows = await listGrowthCaptures(db as never);
  const inbox = withCapturedLeads(buildInbox({ requirements: [{ id: 'r1', title: 'Requirement', at: '2020-01-01T00:00:00.000Z' }] }), rows.map((row) => ({
    id: row.id,
    source: row.source,
    title: row.source,
    at: row.at,
  })));
  assert.ok(inbox.some((item) => item.source === 'meta_instant_form'));
  assert.ok(inbox.some((item) => item.source === 'whatsapp_enquiry'));
  assert.ok(inbox.some((item) => item.source === 'requirement'));
  await captureGrowthLead(db as never, { source: 'meta_instant_form', externalId: 'lead-3', status: 'captured' });
  assert.equal((await db.collection('contacts').find({}).toArray()).length, 1);

  console.log('os-phase7-lead-capture: ok');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
