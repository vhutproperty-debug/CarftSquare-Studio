/**
 * Live production rollout smoke test — full partner registration → OTP → dashboard.
 * Usage: node scripts/verify-production-rollout.mjs [baseUrl]
 */
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { MongoClient } from 'mongodb';
import crypto from 'node:crypto';

const BASE = process.argv[2] || 'https://craftsquare.co.in';
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

loadEnv();

const report = { base: BASE, checks: [] };
function pass(name, detail = '') {
  report.checks.push({ name, ok: true, detail });
  console.log(`PASS: ${name}${detail ? ` — ${detail}` : ''}`);
}
function fail(name, detail) {
  report.checks.push({ name, ok: false, detail });
  console.error(`FAIL: ${name} — ${detail}`);
}

const mobile = `9${String(Date.now()).slice(-9)}`;
const email = `rollout.${mobile}@craftsquare.test`;
const testOtp = String(crypto.randomInt(100000, 999999));

// 1. Home + login page
const home = await fetch(`${BASE}/`, { signal: AbortSignal.timeout(20000) });
if (!home.ok) fail('Home page', `HTTP ${home.status}`);
else pass('Home page', `HTTP ${home.status}`);

const loginPage = await fetch(`${BASE}/partner/login`, { signal: AbortSignal.timeout(20000) });
if (!loginPage.ok) fail('Partner login page', `HTTP ${loginPage.status}`);
else pass('Partner login page', `HTTP ${loginPage.status}`);

// 2. Create partner account (sends real OTP email via Resend)
const reg = await fetch(`${BASE}/api/partner-network/register/quick`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    fullName: 'Production Rollout Test',
    mobile,
    email,
    companyName: 'Rollout QA',
  }),
  signal: AbortSignal.timeout(45000),
});
const regData = await reg.json().catch(() => ({}));
if (!reg.ok || !regData.partnerId) {
  fail('Create Partner Account', regData.error || `HTTP ${reg.status}`);
  console.log(JSON.stringify(report, null, 2));
  process.exit(1);
}
pass('Create Partner Account', regData.partnerId);

if (!regData.emailDelivered && !regData.channels?.includes('email')) {
  fail('OTP email sent via Resend', JSON.stringify(regData));
} else {
  pass('OTP email sent via Resend', regData.message || 'delivered');
}

// 3. Verify OTP (inject hash after real send — email delivery already confirmed above)
const uri = process.env.MONGODB_URI;
const dbName = process.env.DB_NAME || 'brushandbloom';
const client = new MongoClient(uri);
await client.connect();
const db = client.db(dbName);
const partners = db.collection('partner_network_partners');
const otpCol = db.collection('partner_network_otp_sessions');

await otpCol.updateOne(
  { mobile },
  { $set: { otpHash: hashOtp(testOtp, mobile), expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(), attempts: 0 } },
  { upsert: true },
);

const verifyRes = await fetch(`${BASE}/api/partner-network/auth/verify-otp`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',
  body: JSON.stringify({ identifier: mobile, otp: testOtp }),
  signal: AbortSignal.timeout(30000),
});
const verifyData = await verifyRes.json().catch(() => ({}));
const profileCookie = extractCookie(verifyRes, 'pn_profile_session');
if (!verifyRes.ok || !profileCookie) {
  fail('Verify OTP', verifyData.error || 'no session');
} else {
  pass('Verify OTP', verifyData.nextStep || 'profile session');
}

// 4. Complete profile
const profileRes = await fetch(`${BASE}/api/partner-network/profile`, {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json', Cookie: profileCookie },
  credentials: 'include',
  body: JSON.stringify({
    partnerId: regData.partnerId,
    mobile,
    email,
    operatingAreas: 'Mumbai',
    dealType: 'both',
    projectsCovered: 'Residential',
    dealsPerMonth: '5',
    city: 'Mumbai',
    state: 'Maharashtra',
    whatsapp: mobile,
    agreementAccepted: true,
  }),
  signal: AbortSignal.timeout(30000),
});
const profileData = await profileRes.json().catch(() => ({}));
if (!profileRes.ok) fail('Profile completion', profileData.error || `HTTP ${profileRes.status}`);
else pass('Profile completion', profileData.registrationStatus || 'complete');

// 5. Admin approval (DB — simulates admin queue approval)
const partner = await partners.findOne({ partnerId: regData.partnerId });
await partners.updateOne(
  { partnerId: regData.partnerId },
  { $set: { status: 'approved', approvedAt: new Date().toISOString(), updatedAt: new Date().toISOString() } },
);
pass('Admin approval', 'approved via DB');

// 6. Partner login OTP
await otpCol.updateOne(
  { mobile },
  { $set: { otpHash: hashOtp(testOtp, mobile), expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(), attempts: 0 } },
  { upsert: true },
);

const loginSend = await fetch(`${BASE}/api/partner-network/auth/send-otp`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ identifier: mobile, purpose: 'login' }),
  signal: AbortSignal.timeout(30000),
});
const loginSendData = await loginSend.json().catch(() => ({}));
if (!loginSend.ok) fail('Login OTP send', loginSendData.error || `HTTP ${loginSend.status}`);
else pass('Login OTP send', loginSendData.message || 'ok');

await otpCol.updateOne(
  { mobile },
  { $set: { otpHash: hashOtp(testOtp, mobile), expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(), attempts: 0 } },
  { upsert: true },
);

const loginVerify = await fetch(`${BASE}/api/partner-network/auth/verify-otp`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',
  body: JSON.stringify({ identifier: mobile, otp: testOtp }),
  signal: AbortSignal.timeout(30000),
});
const loginData = await loginVerify.json().catch(() => ({}));
const partnerCookie = extractCookie(loginVerify, 'pn_partner_session');
if (!loginVerify.ok || !partnerCookie) fail('Partner login', loginData.error || 'no session');
else pass('Partner login', loginData.nextStep || 'dashboard');

// 7. Dashboard
const dash = await fetch(`${BASE}/api/partner-network/dashboard`, {
  headers: { Cookie: partnerCookie },
  credentials: 'include',
  signal: AbortSignal.timeout(20000),
});
const dashData = await dash.json().catch(() => ({}));
if (!dash.ok || dashData.partner?.partnerId !== regData.partnerId) {
  fail('Partner dashboard', dashData.error || `HTTP ${dash.status}`);
} else {
  pass('Partner dashboard', dashData.partner.partnerId);
}

const dashPage = await fetch(`${BASE}/partner/dashboard`, {
  headers: { Cookie: partnerCookie },
  signal: AbortSignal.timeout(20000),
});
if (!dashPage.ok) fail('Partner dashboard page', `HTTP ${dashPage.status}`);
else pass('Partner dashboard page', `HTTP ${dashPage.status}`);

// Cleanup test partner
await partners.updateOne({ partnerId: regData.partnerId }, { $set: { status: 'rejected' } });
await otpCol.deleteMany({ mobile });
await client.close();

const failed = report.checks.filter((c) => !c.ok).length;
console.log('\n=== PRODUCTION ROLLOUT SMOKE TEST ===');
console.log(JSON.stringify(report, null, 2));
process.exit(failed ? 1 : 0);
