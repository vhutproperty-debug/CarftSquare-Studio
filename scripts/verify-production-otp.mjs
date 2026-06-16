/**
 * Verify production OTP on live deployment.
 * Usage: node scripts/verify-production-otp.mjs [baseUrl]
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

// Home + login
const home = await fetch(`${BASE}/`, { signal: AbortSignal.timeout(20000) });
if (!home.ok) fail('Home page', `HTTP ${home.status}`);
else pass('Home page', `HTTP ${home.status}`);

const login = await fetch(`${BASE}/partner/login`, { signal: AbortSignal.timeout(20000) });
if (!login.ok) fail('Partner login page', `HTTP ${login.status}`);
else pass('Partner login page', `HTTP ${login.status}`);

const uri = process.env.MONGODB_URI;
const dbName = process.env.DB_NAME || 'brushandbloom';
const client = new MongoClient(uri);
await client.connect();
const db = client.db(dbName);
const partner = await db.collection('partner_network_partners').findOne(
  { status: 'approved', email: { $regex: '@' } },
  { sort: { updatedAt: -1 } },
);

if (!partner) {
  fail('Production OTP send', 'No approved partner in database');
  console.log(JSON.stringify(report, null, 2));
  process.exit(1);
}

const sendRes = await fetch(`${BASE}/api/partner-network/auth/send-otp`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ identifier: partner.mobile, purpose: 'login' }),
  signal: AbortSignal.timeout(30000),
});
const sendData = await sendRes.json().catch(() => ({}));
if (!sendRes.ok) {
  fail('OTP email send', sendData.error || `HTTP ${sendRes.status}`);
} else {
  pass('OTP email send', sendData.message || 'ok');
}

const testOtp = '424242';
await db.collection('partner_network_otp_sessions').updateOne(
  { mobile: partner.mobile },
  { $set: { otpHash: hashOtp(testOtp, partner.mobile), expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(), attempts: 0 } },
  { upsert: true },
);

const verifyRes = await fetch(`${BASE}/api/partner-network/auth/verify-otp`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ identifier: partner.mobile, otp: testOtp }),
  signal: AbortSignal.timeout(30000),
});
const verifyData = await verifyRes.json().catch(() => ({}));
const cookie = (verifyRes.headers.getSetCookie?.() || []).find((c) => c.includes('pn_partner_session='))
  || verifyRes.headers.get('set-cookie') || '';
if (!verifyRes.ok || !cookie.includes('pn_partner_session')) {
  fail('OTP verification', verifyData.error || `HTTP ${verifyRes.status}`);
} else {
  pass('OTP verification', verifyData.nextStep || 'session');
}

const sessionCookie = String(cookie).split(';')[0];
const dash = await fetch(`${BASE}/api/partner-network/dashboard`, {
  headers: { Cookie: sessionCookie },
  signal: AbortSignal.timeout(20000),
});
const dashData = await dash.json().catch(() => ({}));
if (!dash.ok || dashData.partner?.partnerId !== partner.partnerId) {
  fail('Partner dashboard', `HTTP ${dash.status}`);
} else {
  pass('Partner dashboard', dashData.partner.partnerId);
}

await client.close();

const failed = report.checks.filter((c) => !c.ok).length;
console.log(JSON.stringify(report, null, 2));
process.exit(failed ? 1 : 0);
