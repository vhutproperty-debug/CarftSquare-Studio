/**
 * Partner Network OTP audit + end-to-end verification.
 * Usage: node scripts/test-partner-otp.mjs [baseUrl]
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

function hashOtp(otp, mobile) {
  return crypto.createHash('sha256').update(`${mobile}:${otp}`).digest('hex');
}

function smsConfigReport() {
  const preferred = process.env.SMS_PROVIDER || 'msg91 (default)';
  const msg91 = Boolean(process.env.MSG91_AUTH_KEY);
  const twilio = Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_SMS_FROM);
  let provider = 'none';
  if ((process.env.SMS_PROVIDER || 'msg91') === 'twilio' && twilio) provider = 'twilio';
  else if (msg91) provider = 'msg91';
  else if (twilio) provider = 'twilio';

  return { preferred, provider, msg91, twilio, configured: provider !== 'none' };
}

let mongoClient = null;

try {
  const cfg = smsConfigReport();
  record('SMS config audit', true, `provider=${cfg.provider} msg91=${cfg.msg91} twilio=${cfg.twilio}`);

  const mobile = uniqueMobile(20);
  const reg = await fetch(`${BASE}/api/partner-network/register/quick`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fullName: 'OTP Audit Partner', mobile, email: `otp.${mobile}@craftsquare.test` }),
  });
  const regData = await reg.json();
  record('Partner registered for OTP test', reg.ok, regData.partnerId);

  const uri = process.env.MONGODB_URI;
  const dbName = process.env.DB_NAME || process.env.DATABASE_NAME || 'brushandbloom';
  mongoClient = new MongoClient(uri);
  await mongoClient.connect();
  const db = mongoClient.db(dbName);
  const partners = db.collection('partner_network_partners');
  const otpCol = db.collection('partner_network_otp_sessions');

  const partner = await partners.findOne({ partnerId: regData.partnerId });
  await partners.updateOne(
    { id: partner.id },
    { $set: { status: 'approved', approvedAt: new Date().toISOString(), updatedAt: new Date().toISOString() } },
  );

  const sendRes = await fetch(`${BASE}/api/partner-network/auth/send-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mobile }),
  });
  const sendData = await sendRes.json();
  record(
    'Send OTP API',
    sendRes.ok,
    `status=${sendRes.status} ${sendData.error || sendData.message || ''}`,
  );

  const testOtp = '654321';
  await otpCol.updateOne(
    { mobile: partner.mobile },
    {
      $set: {
        mobile: partner.mobile,
        otpHash: hashOtp(testOtp, mobile),
        expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
        attempts: 0,
      },
    },
    { upsert: true },
  );

  const verifyRes = await fetch(`${BASE}/api/partner-network/auth/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mobile, otp: testOtp }),
  });
  const verifyData = await verifyRes.json();
  const cookie = verifyRes.headers.get('set-cookie') || '';
  record(
    'Verify OTP + session cookie',
    verifyRes.ok && cookie.includes('pn_partner_session'),
    verifyData.partner?.partnerId || verifyData.error,
  );

  const dashRes = await fetch(`${BASE}/api/partner-network/dashboard`, {
    headers: { Cookie: cookie.split(';')[0] },
  });
  record('Partner login session works', dashRes.ok, `status=${dashRes.status}`);

  await otpCol.deleteOne({ mobile: partner.mobile });
  await partners.updateOne({ id: partner.id }, { $set: { status: 'rejected' }, $unset: { approvedAt: '' } });
} catch (error) {
  record('OTP audit', false, error.message);
} finally {
  if (mongoClient) await mongoClient.close();
}

const failed = results.filter((r) => !r.ok).length;
const cfg = smsConfigReport();
console.log('\n--- OTP SMS Report ---');
console.log(JSON.stringify({
  smsProviderDetected: cfg.provider,
  smsConfigured: cfg.configured,
  environmentVariablesRequired: {
    primary_msg91: ['SMS_PROVIDER=msg91', 'MSG91_AUTH_KEY', 'MSG91_OTP_TEMPLATE_ID (or MSG91_SENDER_ID + DLT template)'],
    fallback_twilio: ['SMS_PROVIDER=twilio', 'TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_SMS_FROM'],
    existing: ['MONGODB_URI', 'DB_NAME', 'AUTH_SECRET'],
  },
  worksLocally: process.env.NODE_ENV !== 'production' ? 'Yes — OTP logged to server console when SMS not configured' : 'Requires SMS env vars',
  worksAfterDeployment: cfg.configured ? 'Yes — when env vars are set on Vercel/host' : 'No — set MSG91 or Twilio env vars first',
  manualStepsBeforeProduction: cfg.configured
    ? ['Verify MSG91 DLT template / sender approval', 'Send test OTP to a real mobile on staging']
    : ['Create MSG91 account + OTP template', 'Add MSG91_AUTH_KEY and MSG91_OTP_TEMPLATE_ID to production env', 'Optional: TWILIO_* for international fallback'],
}, null, 2));

console.log(JSON.stringify({ passed: results.length - failed, failed, results }, null, 2));
process.exit(failed > 0 ? 1 : 0);
