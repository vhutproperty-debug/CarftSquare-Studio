import assert from 'node:assert/strict';
import { onNewLead } from '../lib/leads/pipeline';
import { getMetaAdsReadiness } from '../lib/meta-ads/readiness';
import { createMemoryDb } from './lib/memory-db';

process.env.META_LEADS_ENABLED = 'true';
process.env.WHATSAPP_ENABLED = 'true';
process.env.WHATSAPP_PHONE_NUMBER_ID = '1307101749164145';
process.env.WHATSAPP_WABA_ID = '4424945177816319';
process.env.WHATSAPP_ACCESS_TOKEN = 'wa-test-token';
process.env.META_GRAPH_API_VERSION = 'v22.0';
process.env.OWNER_ALERT_WHATSAPP = '919800000001';
process.env.OWNER_ALERT_EMAIL = 'owner@example.com';
process.env.LEAD_ASSIGNEES = JSON.stringify([{ id: 'arun', name: 'Arun', email: 'arun@example.com' }]);
process.env.RESEND_API_KEY = 're_test';
process.env.EMAIL_FROM = 'CraftSquare <notifications@craftsquare.co.in>';
process.env.NEXT_PUBLIC_SITE_URL = 'https://craftsquare.co.in';
process.env.META_ADS_ENABLED = 'true';
process.env.META_SYSTEM_USER_TOKEN = 'system-user';

async function main() {
const sends: string[] = [];
const originalFetch = global.fetch;
global.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input);
  const body = typeof init?.body === 'string' ? init.body : '';
  sends.push(url);
  if (url.includes('graph.facebook.com') && url.includes('/messages')) {
    assert.equal(body.includes('"status":"ACTIVE"'), false);
    return new Response(JSON.stringify({ messages: [{ id: `wamid.${sends.length}` }] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  if (url.includes('api.resend.com')) {
    const parsed = JSON.parse(body);
    assert.equal(parsed.to[0], 'owner@example.com');
    assert.match(parsed.html, /tel:/);
    assert.match(parsed.html, /ops\/leads\/meta_ads\/lead-1/);
    return new Response(JSON.stringify({ id: 'email_1' }), { status: 200 });
  }
  if (url.includes('/me/permissions')) {
    return new Response(JSON.stringify({
      data: [{ permission: 'read_ads_dataset_quality', status: 'granted' }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
  return new Response(JSON.stringify({ id: 'x' }), { status: 200 });
}) as typeof fetch;

const db = createMemoryDb();
const lead = {
  id: 'lead-1',
  source: 'meta_ads',
  name: 'Asha Patel',
  phone: '9876543210',
  email: 'asha@example.com',
  project: 'Availability check',
  campaign: 'Goregaon Owners',
  collection: 'meta_ads_leads',
};
await db.collection('meta_ads_leads').insertOne({ id: 'lead-1', phone: '9876543210' });

const first = await onNewLead(lead, db as never);
assert.equal(first.welcomeSent, true);
assert.equal(first.ownerAlerted, true);
assert.equal(first.followupsScheduled, true);
assert.equal(first.assignedTo, 'arun');
const welcomeCalls = sends.filter((url) => url.includes('/messages')).length;
assert.equal(welcomeCalls, 2, 'lead welcome + owner alert');
assert.equal(sends.some((url) => url.includes('api.resend.com')), true);

const jobs = await db.collection('ops_follow_up_jobs').find({ targetId: 'lead-1' }).toArray();
assert.equal(jobs.length, 2);
assert.ok(jobs.some((job) => job.templateName === 'lead_followup_day1'));
assert.ok(jobs.some((job) => job.templateName === 'lead_followup_day3'));
const stored = await db.collection('meta_ads_leads').findOne({ id: 'lead-1' });
assert.equal(stored?.assignedTo, 'arun');

const again = await onNewLead(lead, db as never);
assert.equal(again.duplicate, true);
assert.equal(sends.filter((url) => url.includes('/messages')).length, welcomeCalls);

const readiness = await getMetaAdsReadiness();
assert.equal(readiness.adsEnabled, true);
assert.equal(readiness.canPublishPaused, false);
assert.ok(readiness.missingPermissions.includes('ads_management'));
assert.ok(readiness.missingPermissions.includes('leads_retrieval'));

global.fetch = originalFetch;
console.log('test:lead-pipeline ok');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
