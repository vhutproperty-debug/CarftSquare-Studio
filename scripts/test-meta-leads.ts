import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { verifyXHubSignature256 } from '../lib/whatsapp-cloud/signature';
import { processLeadgenPayload } from '../lib/meta-leads/ingest';
import { acceptDataDeletionRequest, lookupDataDeletion, parseSignedRequest } from '../lib/meta/data-deletion';
import { createMemoryDb } from './lib/memory-db';

process.env.META_LEAD_ADS_VERIFY_TOKEN = 'lead-verify';
process.env.META_APP_SECRET = 'app-secret';
process.env.META_PAGE_ACCESS_TOKEN = 'page-token';
process.env.META_GRAPH_API_VERSION = 'v22.0';
process.env.META_LEADS_ENABLED = 'true';
process.env.WHATSAPP_ENABLED = 'false';
process.env.NEXT_PUBLIC_SITE_URL = 'https://craftsquare.co.in';

async function main() {
const { GET, POST } = await import('../app/api/webhooks/meta-leads/route');
const challenge = await GET(new Request('https://craftsquare.co.in/api/webhooks/meta-leads?hub.mode=subscribe&hub.verify_token=lead-verify&hub.challenge=chal'));
assert.equal(challenge.status, 200);
assert.equal(await challenge.text(), 'chal');
const bad = await GET(new Request('https://craftsquare.co.in/api/webhooks/meta-leads?hub.mode=subscribe&hub.verify_token=no&hub.challenge=chal'));
assert.equal(bad.status, 403);

const unsigned = await POST(new Request('https://craftsquare.co.in/api/webhooks/meta-leads', {
  method: 'POST',
  body: '{}',
}));
assert.equal(unsigned.status, 401);

const savedSecret = process.env.META_APP_SECRET;
delete process.env.META_APP_SECRET;
assert.equal(verifyXHubSignature256('{}', null), false);
process.env.META_APP_SECRET = savedSecret;

const payload = {
  object: 'page',
  entry: [{
    id: '1351127224742253',
    changes: [{
      field: 'leadgen',
      value: {
        leadgen_id: 'lead-100',
        page_id: '1351127224742253',
        form_id: 'form-9',
        ad_id: 'ad-9',
        created_time: 1_700_000_000,
      },
    }],
  }],
};

const originalFetch = global.fetch;
let graphCalls = 0;
global.fetch = (async (input: RequestInfo | URL) => {
  const url = String(input);
  if (url.includes('/lead-100')) {
    graphCalls += 1;
    assert.equal(url.includes('v22.0'), true);
    assert.equal(url.includes('campaign_name'), true);
    assert.equal(url.includes('META_ACCESS_TOKEN'), false);
    return new Response(JSON.stringify({
      campaign_id: 'cmp-1',
      campaign_name: 'Goregaon Owners',
      ad_id: 'ad-9',
      ad_name: 'Availability check',
      adset_id: 'set-1',
      adset_name: 'Mumbai',
      form_id: 'form-9',
      platform: 'fb',
      field_data: [
        { name: 'full_name', values: ['Asha Patel'] },
        { name: 'phone_number', values: ['9876543210'] },
        { name: 'email', values: ['asha@example.com'] },
      ],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
  return new Response('{}', { status: 200 });
}) as typeof fetch;

const db = createMemoryDb();
const first = await processLeadgenPayload(db as never, payload);
assert.equal(first.accepted, 1);
const second = await processLeadgenPayload(db as never, payload);
assert.equal(second.accepted, 1);
assert.equal(graphCalls, 1, 'repeat webhook does not re-fetch');
const lead = await db.collection('meta_ads_leads').findOne({ id: 'lead-100' });
assert.equal(lead?.campaignName, 'Goregaon Owners');
assert.equal(lead?.adName, 'Availability check');
assert.equal(lead?.adsetName, 'Mumbai');
assert.equal(lead?.phone, '9876543210');
assert.equal(lead?.status, 'new');
const count = await db.collection('meta_ads_leads').countDocuments({ id: 'lead-100' });
assert.equal(count, 1);

global.fetch = originalFetch;

function signedRequest(payloadObj: object, secret: string) {
  const encoded = Buffer.from(JSON.stringify(payloadObj)).toString('base64url');
  const sig = createHmac('sha256', secret).update(encoded).digest('base64url');
  return `${sig}.${encoded}`;
}

const request = signedRequest({ user_id: '99887766' }, 'app-secret');
assert.ok(parseSignedRequest(request, 'app-secret')?.user_id);
await db.collection('meta_ads_leads').insertOne({
  id: 'lead-fb',
  name: 'Secret',
  phone: '9999999999',
  email: 's@example.com',
  fbUserId: '99887766',
  fieldData: { note: '99887766' },
});
const deletion = await acceptDataDeletionRequest(db as never, request, 'app-secret');
assert.equal(deletion.ok, true);
if (deletion.ok) {
  assert.equal(deletion.url.startsWith('https://'), true);
  const status = await lookupDataDeletion(db as never, deletion.confirmation_code);
  assert.equal(status?.status, 'completed');
}
const scrubbed = await db.collection('meta_ads_leads').findOne({ id: 'lead-fb' });
assert.equal(scrubbed?.name, 'deleted');
assert.equal(scrubbed?.phone, '');

console.log('test:meta-leads ok');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
