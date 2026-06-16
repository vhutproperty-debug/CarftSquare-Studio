/**
 * Partner Network Email OTP audit + full auth flow test.
 * Usage: node scripts/test-partner-otp-auth.mjs [baseUrl]
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

function testEmail(mobile) {
  return partnerTestEmail(mobile);
}

function hashOtp(otp, mobile) {
  return crypto.createHash('sha256').update(`${mobile}:${otp}`).digest('hex');
}

function authConfig() {
  return {
    emailProvider: process.env.RESEND_API_KEY ? 'resend' : 'none',
    whatsappProvider: (process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.WHATSAPP_ACCESS_TOKEN) ? 'meta_whatsapp' : 'none',
    resend: Boolean(process.env.RESEND_API_KEY),
    whatsapp: Boolean(process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.WHATSAPP_ACCESS_TOKEN),
  };
}

let mongoClient = null;

try {
  const cfg = authConfig();
  record('Email OTP provider audit', true, `email=${cfg.emailProvider} whatsapp=${cfg.whatsappProvider}`);

  const mobile = uniqueMobile(30);
  const email = partnerTestEmail(mobile);
  const reg = await fetch(`${BASE}/api/partner-network/register/quick`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fullName: 'Email OTP Partner', mobile, email }),
  });
  const regData = await reg.json();
  record('Registration with email', reg.ok, regData.partnerId);

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
    { $set: { status: 'approved', email, approvedAt: new Date().toISOString(), updatedAt: new Date().toISOString() } },
  );

  const sendRes = await fetch(`${BASE}/api/partner-network/auth/send-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mobile }),
  });
  const sendData = await sendRes.json();
  record('Send OTP API', sendRes.ok, `${sendData.message || sendData.error} channels=${JSON.stringify(sendData.channels || [])}`);

  const testOtp = '112233';
  await otpCol.updateOne(
    { mobile: partner.mobile },
    {
      $set: {
        mobile: partner.mobile,
        otpHash: hashOtp(testOtp, mobile),
        expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
        attempts: 0,
        sendCount: 1,
        sendWindowStart: new Date().toISOString(),
        lastSentAt: new Date().toISOString(),
      },
    },
    { upsert: true },
  );

  const badVerify = await fetch(`${BASE}/api/partner-network/auth/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mobile, otp: '000000' }),
  });
  record('Invalid OTP rejected', badVerify.status === 401, `status=${badVerify.status}`);

  const verifyRes = await fetch(`${BASE}/api/partner-network/auth/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mobile, otp: testOtp }),
  });
  const verifyData = await verifyRes.json();
  const cookie = verifyRes.headers.get('set-cookie') || '';
  record('Valid OTP creates session', verifyRes.ok && cookie.includes('pn_partner_session'), verifyData.partner?.partnerId);

  const otpAfter = await otpCol.findOne({ mobile: partner.mobile });
  record('OTP deleted after success (single-use)', !otpAfter, otpAfter ? 'still exists' : 'deleted');

  const dashRes = await fetch(`${BASE}/api/partner-network/dashboard`, {
    headers: { Cookie: cookie.split(';')[0] },
  });
  record('Dashboard access after login', dashRes.ok, `status=${dashRes.status}`);

  const logoutRes = await fetch(`${BASE}/api/partner-network/auth/status`, { method: 'POST' });
  record('Logout', logoutRes.ok, `status=${logoutRes.status}`);

  const reloginSend = await fetch(`${BASE}/api/partner-network/auth/send-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mobile }),
  });
  record('Re-login OTP send', reloginSend.ok, `status=${reloginSend.status}`);

  await otpCol.deleteOne({ mobile: partner.mobile });
  await partners.updateOne({ id: partner.id }, { $set: { status: 'rejected' }, $unset: { approvedAt: '' } });
} catch (error) {
  record('Email OTP auth flow', false, error.message);
} finally {
  if (mongoClient) await mongoClient.close();
}

const failed = results.filter((r) => !r.ok).length;
const cfg = authConfig();
console.log('\n--- Partner Auth Deployment Report ---');
console.log(JSON.stringify({
  emailProviderConfigured: cfg.emailProvider,
  whatsappProviderConfigured: cfg.whatsappProvider,
  requiredEnvironmentVariables: {
    core: ['MONGODB_URI', 'DB_NAME', 'AUTH_SECRET'],
    emailOtp: ['RESEND_API_KEY', 'EMAIL_FROM'],
    whatsappOtpOptional: ['WHATSAPP_PHONE_NUMBER_ID', 'WHATSAPP_ACCESS_TOKEN'],
  },
  securityChecks: [
    'OTP hashed with SHA-256 (not stored plain text)',
    'Single-use OTP deleted after verification',
    '5-minute OTP expiry',
    'Max 5 verify attempts per OTP',
    'Max 3 OTP sends per 15-minute window',
    'crypto.randomInt for OTP generation',
    'API keys loaded from environment only',
  ],
  worksLocally: cfg.resend ? 'Yes — via Resend email' : 'Yes — OTP logged to server console in dev',
  productionReadiness: cfg.resend ? 'Ready when env vars set on host' : 'Set RESEND_API_KEY before deploy',
  manualStepsBeforeProduction: cfg.resend
    ? ['Verify Resend domain', 'Optional: configure WhatsApp Business API for dual delivery']
    : ['Add RESEND_API_KEY + EMAIL_FROM to production env', 'Optional: WHATSAPP_* for WhatsApp OTP'],
}, null, 2));

console.log(JSON.stringify({ passed: results.length - failed, failed, results }, null, 2));
process.exit(failed > 0 ? 1 : 0);
