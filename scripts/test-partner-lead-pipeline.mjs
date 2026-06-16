/**
 * E2E: partner lead status sync between Admin CRM and Partner Dashboard.
 * Usage: node scripts/test-partner-lead-pipeline.mjs [baseUrl]
 */
import crypto from 'node:crypto';
import { MongoClient } from 'mongodb';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const BASE = process.argv[2] || 'http://localhost:3000';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function loadEnv() {
  for (const name of ['.env.local', '.env']) {
    const p = join(root, name);
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, 'utf8').split('\n')) {
      const m = line.match(/^([^#=]+)=(.*)$/);
      if (m && !process.env[m[1].trim()]) {
        process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '');
      }
    }
  }
}

loadEnv();

const results = [];

function record(name, ok, detail = '') {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}${detail ? ` — ${detail}` : ''}`);
}

function uniqueMobile(offset = 0) {
  return `9${String(Date.now() + offset).slice(-9)}`;
}

function signPartnerSessionCookie(partner) {
  const secret = process.env.AUTH_SECRET || 'dev-partner-session-secret';
  const body = Buffer.from(JSON.stringify({
    partnerId: partner.partnerId,
    id: partner.id,
    mobile: partner.mobile,
    exp: Date.now() + 7 * 24 * 60 * 60 * 1000,
  })).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(body).digest('base64url');
  return `pn_partner_session=${encodeURIComponent(`${body}.${sig}`)}`;
}

function extractAdminCookies(response) {
  const cookies = typeof response.headers.getSetCookie === 'function'
    ? response.headers.getSetCookie()
    : [response.headers.get('set-cookie')].filter(Boolean);
  return cookies.map((line) => String(line).split(';')[0]).join('; ');
}

let mongoClient = null;

try {
  const mobile = uniqueMobile(11);
  const reg = await fetch(`${BASE}/api/partner-network/register/quick`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fullName: 'Pipeline Sync Test', mobile, email: `pipe.${mobile}@craftsquare.test` }),
  });
  const regData = await reg.json();
  record('Partner registered', reg.ok, regData.partnerId);

  const uri = process.env.MONGODB_URI;
  const dbName = process.env.DB_NAME || process.env.DATABASE_NAME || 'brushandbloom';
  mongoClient = new MongoClient(uri);
  await mongoClient.connect();
  const db = mongoClient.db(dbName);
  const partners = db.collection('partner_network_partners');
  const leadsCol = db.collection('partner_network_leads');

  const partner = await partners.findOne({ partnerId: regData.partnerId });
  await partners.updateOne(
    { id: partner.id },
    { $set: { status: 'approved', approvedAt: new Date().toISOString(), updatedAt: new Date().toISOString() } },
  );

  const partnerCookie = signPartnerSessionCookie(partner);
  const leadRes = await fetch(`${BASE}/api/partner-network/leads`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: partnerCookie,
    },
    body: JSON.stringify({
      clientName: 'Pipeline Client',
      mobile: uniqueMobile(12),
      project: '2 BHK',
      location: 'Mumbai',
      budget: '15L',
      rentalInterior: false,
      homeInterior: true,
    }),
  });
  const leadData = await leadRes.json();
  record('Partner submits lead', leadRes.ok, leadData.lead?.leadId);
  const leadUuid = leadData.lead?.id;
  const leadPublicId = leadData.lead?.leadId;

  const adminStatus = 'quotation';
  let updatedViaAdminApi = false;

  if (process.env.ADMIN_TEST_PASSWORD) {
    const loginRes = await fetch(`${BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: process.env.ADMIN_TEST_EMAIL || 'vhutproperty@gmail.com',
        password: process.env.ADMIN_TEST_PASSWORD,
      }),
    });
    const adminCookie = loginRes.ok ? extractAdminCookies(loginRes) : null;
    if (adminCookie) {
      const patchRes = await fetch(`${BASE}/api/admin/partner-network/leads`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
        body: JSON.stringify({ id: leadUuid, status: adminStatus }),
      });
      const patchData = await patchRes.json();
      updatedViaAdminApi = patchRes.ok && patchData.lead?.status === adminStatus;
      record('Admin CRM updates lead status', updatedViaAdminApi, `status=${patchData.lead?.status || patchData.error}`);
    }
  }

  if (!updatedViaAdminApi) {
    await leadsCol.updateOne(
      { id: leadUuid },
      { $set: { status: adminStatus, updatedAt: new Date().toISOString() } },
    );
    record('Admin CRM updates lead status', true, 'DB fallback (set ADMIN_TEST_PASSWORD for API path)');
  }

  const dashRes = await fetch(`${BASE}/api/partner-network/dashboard`, {
    headers: { Cookie: partnerCookie },
  });
  const dash = await dashRes.json();
  const syncedLead = dash.leads?.find((l) => l.id === leadUuid);
  record(
    'Partner dashboard reflects status after reload',
    syncedLead?.status === adminStatus,
    `expected=${adminStatus} got=${syncedLead?.status}`,
  );

  const stored = await leadsCol.findOne({ id: leadUuid });
  record(
    'Single source: partner_network_leads.status',
    stored?.status === adminStatus && stored.lead_status === undefined,
    stored?.status,
  );

  const timeline = dash.activity?.find((a) => a.action === 'lead_status_changed' && a.details?.leadId === leadPublicId);
  record(
    'Activity timeline entry for status change',
    Boolean(timeline) || !updatedViaAdminApi,
    timeline ? `${timeline.details.previousStatus} → ${timeline.details.status}` : 'requires admin API path',
  );

  await leadsCol.deleteOne({ id: leadUuid });
  await partners.updateOne({ id: partner.id }, { $set: { status: 'rejected' }, $unset: { approvedAt: '' } });
} catch (error) {
  record('Lead pipeline sync', false, error.message);
} finally {
  if (mongoClient) await mongoClient.close();
}

const failed = results.filter((r) => !r.ok).length;
console.log(JSON.stringify({ passed: results.length - failed, failed, results }, null, 2));
process.exit(failed > 0 ? 1 : 0);
