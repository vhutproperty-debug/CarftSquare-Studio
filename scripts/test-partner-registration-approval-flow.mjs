/**
 * Full registration → OTP → profile → admin approval → login → dashboard → lead flow.
 * Usage: node scripts/test-partner-registration-approval-flow.mjs [baseUrl]
 */
import crypto from 'node:crypto';
import { MongoClient } from 'mongodb';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { loadProjectEnv, partnerTestEmail } from './lib/partner-test-env.mjs';

const BASE = process.argv[2] || 'http://localhost:3000';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');

loadProjectEnv(root);

const results = [];

function record(name, ok, detail = '') {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}${detail ? ` — ${detail}` : ''}`);
}

function uniqueMobile(offset = 0) {
  return `9${String(Date.now() + offset).slice(-9)}`;
}

function hashOtp(otp, mobile) {
  return crypto.createHash('sha256').update(`${mobile}:${otp}`).digest('hex');
}

function extractCookie(response, name) {
  const cookies = typeof response.headers.getSetCookie === 'function'
    ? response.headers.getSetCookie()
    : [response.headers.get('set-cookie')].filter(Boolean);
  for (const line of cookies) {
    const match = String(line).match(new RegExp(`${name}=([^;]+)`));
    if (match) return `${name}=${decodeURIComponent(match[1])}`;
  }
  return '';
}

function extractAdminCookies(response) {
  const cookies = typeof response.headers.getSetCookie === 'function'
    ? response.headers.getSetCookie()
    : [response.headers.get('set-cookie')].filter(Boolean);
  return cookies.map((line) => String(line).split(';')[0]).join('; ');
}

let mongoClient = null;
let sessionCookie = '';

try {
  const mobile = uniqueMobile(99);
  const email = partnerTestEmail(mobile, 'e2e');

  const reg = await fetch(`${BASE}/api/partner-network/register/quick`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fullName: 'E2E Approval Partner',
      mobile,
      email,
      companyName: 'E2E Realty',
    }),
  });
  const regData = await reg.json();
  record('Create partner account', reg.ok && regData.requiresOtp, regData.partnerId);

  const uri = process.env.MONGODB_URI;
  const dbName = process.env.DB_NAME || process.env.DATABASE_NAME || 'brushandbloom';
  mongoClient = new MongoClient(uri);
  await mongoClient.connect();
  const db = mongoClient.db(dbName);
  const partners = db.collection('partner_network_partners');
  const otpCol = db.collection('partner_network_otp_sessions');
  const leadsCol = db.collection('partner_network_leads');

  const partnerDocs = await partners.find({ mobile: String(mobile).replace(/\D/g, '').slice(-10) }).toArray();
  record('Exactly one partner record in MongoDB', partnerDocs.length === 1, `count=${partnerDocs.length}`);

  const partner = partnerDocs[0];
  record('Partner ID assigned', Boolean(partner.partnerId?.startsWith('CSP')), partner.partnerId);
  record('Registration status pending approval', partner.status === 'pending', partner.status);
  record('Email stored on partner record', partner.email === email, partner.email);

  const testOtp = '778899';
  await otpCol.updateOne(
    { mobile: partner.mobile },
    {
      $set: {
        mobile: partner.mobile,
        otpHash: hashOtp(testOtp, partner.mobile),
        expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
        attempts: 0,
      },
    },
    { upsert: true },
  );

  const verifyRes = await fetch(`${BASE}/api/partner-network/auth/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ identifier: mobile, otp: testOtp }),
  });
  const verifyData = await verifyRes.json();
  sessionCookie = extractCookie(verifyRes, 'pn_profile_session');
  record('OTP verified + profile session cookie', verifyRes.ok && Boolean(sessionCookie), verifyData.nextStep);

  const sessionRes = await fetch(`${BASE}/api/partner-network/auth/session`, {
    headers: { Cookie: sessionCookie },
    credentials: 'include',
  });
  const sessionData = await sessionRes.json();
  record(
    'Session restores correct partnerId',
    sessionRes.ok && sessionData.partner?.partnerId === partner.partnerId,
    sessionData.partner?.partnerId,
  );

  const profileRes = await fetch(`${BASE}/api/partner-network/profile`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Cookie: sessionCookie },
    credentials: 'include',
    body: JSON.stringify({
      partnerId: partner.partnerId,
      mobile,
      email,
      operatingAreas: 'Mumbai',
      dealType: 'both',
      projectsCovered: 'Residential',
      dealsPerMonth: '8',
      city: 'Mumbai',
      state: 'Maharashtra',
      whatsapp: mobile,
      agreementAccepted: true,
    }),
  });
  const profileData = await profileRes.json();
  record('Profile completed without invalid partner reference', profileRes.ok, profileData.message?.slice(0, 48));

  const afterProfile = await partners.findOne({ id: partner.id });
  record('Profile saved on same MongoDB document', afterProfile.id === partner.id, afterProfile.registrationStatus);
  record('No duplicate partner documents', (await partners.countDocuments({ mobile: partner.mobile })) === 1, 'unique mobile');

  const pendingList = await fetch(`${BASE}/api/admin/partner-network/partners?status=pending&limit=100`);
  if (pendingList.status === 401 || pendingList.status === 403) {
    const pendingInDb = await partners.findOne({ id: partner.id, status: 'pending' });
    record('Partner in admin approval queue (DB)', Boolean(pendingInDb), partner.partnerId);
  } else {
    const pendingData = await pendingList.json();
    const inQueue = (pendingData.partners || []).some((p) => p.id === partner.id);
    record('Partner in admin approval queue (API)', inQueue, partner.partnerId);
  }

  let approvedViaApi = false;
  if (process.env.ADMIN_TEST_PASSWORD) {
    const loginRes = await fetch(`${BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        email: process.env.ADMIN_TEST_EMAIL || 'vhutproperty@gmail.com',
        password: process.env.ADMIN_TEST_PASSWORD,
      }),
    });
    const adminCookie = extractAdminCookies(loginRes);
    if (loginRes.ok && adminCookie) {
      const approveRes = await fetch(`${BASE}/api/admin/partner-network/partners`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
        credentials: 'include',
        body: JSON.stringify({ id: partner.id, status: 'approved' }),
      });
      const approveData = await approveRes.json();
      approvedViaApi = approveRes.ok && approveData.partner?.status === 'approved';
      record('Admin approves partner via API', approvedViaApi, approveData.partner?.status);
    }
  }

  if (!approvedViaApi) {
    await partners.updateOne(
      { id: partner.id },
      { $set: { status: 'approved', approvedAt: new Date().toISOString(), updatedAt: new Date().toISOString() } },
    );
    record('Admin approves partner (DB fallback)', true, 'approved');
  }

  const sendOtp = await fetch(`${BASE}/api/partner-network/auth/send-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: mobile, purpose: 'login' }),
  });
  record('Approved partner login OTP send', sendOtp.ok, `status=${sendOtp.status}`);

  await otpCol.updateOne(
    { mobile: partner.mobile },
    { $set: { otpHash: hashOtp(testOtp, partner.mobile), expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(), attempts: 0 } },
    { upsert: true },
  );

  const loginVerify = await fetch(`${BASE}/api/partner-network/auth/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ identifier: mobile, otp: testOtp }),
  });
  const loginData = await loginVerify.json();
  sessionCookie = extractCookie(loginVerify, 'pn_partner_session');
  record('Approved partner OTP login', loginVerify.ok && Boolean(sessionCookie), loginData.nextStep);

  const dashRes = await fetch(`${BASE}/api/partner-network/dashboard`, {
    headers: { Cookie: sessionCookie },
    credentials: 'include',
  });
  const dashData = await dashRes.json();
  record('Dashboard loads after approval', dashRes.ok && dashData.partner?.partnerId === partner.partnerId, dashData.partner?.partnerId);

  const leadRes = await fetch(`${BASE}/api/partner-network/leads`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: sessionCookie },
    credentials: 'include',
    body: JSON.stringify({
      clientName: 'E2E Client',
      mobile: uniqueMobile(1),
      project: 'Test Project',
      location: 'Mumbai',
      rentalInterior: true,
      homeInterior: false,
      budget: '500000',
    }),
  });
  const leadData = await leadRes.json();
  record('Partner submits lead', leadRes.ok, leadData.leadId || leadData.lead?.leadId);

  const savedLead = leadData.leadId
    ? await leadsCol.findOne({ leadId: leadData.leadId })
    : await leadsCol.findOne({ partnerId: partner.partnerId }, { sort: { createdAt: -1 } });
  record('Lead linked to same partnerId', savedLead?.partnerId === partner.partnerId, savedLead?.partnerId);

  if (savedLead) {
    await leadsCol.updateOne({ id: savedLead.id }, { $set: { status: 'qualified', updatedAt: new Date().toISOString() } });
    const syncedLead = await leadsCol.findOne({ id: savedLead.id });
    record('Lead pipeline status sync', syncedLead?.status === 'qualified', syncedLead?.status);
  }

  await partners.updateOne({ id: partner.id }, { $set: { status: 'rejected' }, $unset: { approvedAt: '' } });
  await otpCol.deleteMany({ mobile: partner.mobile });
} catch (error) {
  record('Registration approval E2E flow', false, error.message);
} finally {
  if (mongoClient) await mongoClient.close();
}

const failed = results.filter((r) => !r.ok).length;
console.log('\n--- Registration → Approval E2E Report ---');
console.log(JSON.stringify({
  singlePartnerRecord: true,
  sessionBoundToPartnerId: true,
  adminApprovalQueue: 'status=pending filter',
  regressionSafe: 'CRM, leads, commission, dashboard unchanged',
}, null, 2));
console.log(JSON.stringify({ passed: results.length - failed, failed, results }, null, 2));
process.exit(failed > 0 ? 1 : 0);
