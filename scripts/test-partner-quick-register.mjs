/**
 * Partner quick registration + profile session smoke tests.
 * Usage: node scripts/test-partner-quick-register.mjs [baseUrl]
 */
import crypto from 'node:crypto';

const BASE = process.argv[2] || 'http://localhost:3000';

const results = [];

let sharedMobile = '';
let sharedPartnerId = '';
let sharedEmail = '';
let sessionCookie = '';

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

function hashOtp(otp, mobile) {
  return crypto.createHash('sha256').update(`${mobile}:${otp}`).digest('hex');
}

async function test(name, fn) {
  try {
    const detail = await fn();
    results.push({ name, ok: true, detail });
    console.log(`PASS: ${name}`, detail || '');
  } catch (e) {
    results.push({ name, ok: false, error: e.message });
    console.error(`FAIL: ${name}`, e.message);
  }
}

function uniqueMobile(offset = 0) {
  const base = String(Date.now() + offset).slice(-9);
  return `9${base}`;
}

function testEmail(mobile) {
  return `partner.${mobile}@craftsquare.test`;
}

await test('Name + Mobile + Email', async () => {
  const mobile = uniqueMobile(1);
  sharedMobile = mobile;
  sharedEmail = testEmail(mobile);
  const res = await fetch(`${BASE}/api/partner-network/register/quick`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fullName: 'Test Partner A', mobile, email: sharedEmail }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(data));
  if (!data.partnerId?.startsWith('CSP')) throw new Error('missing partnerId');
  if (!data.requiresOtp) throw new Error('expected requiresOtp');
  sharedPartnerId = data.partnerId;
  return data.partnerId;
});

await test('Name + Mobile + Email + Company', async () => {
  const mobile = uniqueMobile(2);
  const res = await fetch(`${BASE}/api/partner-network/register/quick`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fullName: 'Test Partner B', mobile, email: testEmail(mobile), companyName: 'ABC Realty' }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(data));
  if (!data.requiresOtp) throw new Error('missing requiresOtp');
  return `${data.partnerId} company ok`;
});

await test('Empty Company string', async () => {
  const mobile = uniqueMobile(3);
  const res = await fetch(`${BASE}/api/partner-network/register/quick`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fullName: 'Test Partner C', mobile, email: testEmail(mobile), companyName: '' }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(data));
  return data.partnerId;
});

await test('Registration rejects missing email', async () => {
  const mobile = uniqueMobile(4);
  const res = await fetch(`${BASE}/api/partner-network/register/quick`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fullName: 'No Email', mobile }),
  });
  if (res.ok) throw new Error('expected validation failure');
  return `status=${res.status}`;
});

await test('Duplicate Mobile resumes incomplete', async () => {
  const mobile = sharedMobile;
  const res = await fetch(`${BASE}/api/partner-network/register/quick`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fullName: 'Test Partner A', mobile, email: sharedEmail }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(data));
  return `resumed ${data.partnerId}`;
});

await test('Profile PATCH without session rejected', async () => {
  const res = await fetch(`${BASE}/api/partner-network/profile`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      partnerId: sharedPartnerId,
      mobile: sharedMobile,
      city: 'Mumbai',
    }),
  });
  const data = await res.json();
  if (res.status !== 401) throw new Error(`expected 401, got ${res.status}: ${JSON.stringify(data)}`);
  return '401';
});

await test('Verify OTP then profile PATCH succeeds', async () => {
  const testOtp = '778899';
  const otpRes = await fetch(`${BASE}/api/partner-network/auth/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mobile: sharedMobile, otp: testOtp }),
  });
  if (otpRes.status === 400 || otpRes.status === 401) {
    const { MongoClient } = await import('mongodb');
    const { readFileSync, existsSync } = await import('fs');
    const { join, dirname } = await import('path');
    const { fileURLToPath } = await import('url');
    const root = join(dirname(fileURLToPath(import.meta.url)), '..');
    for (const name of ['.env.local', '.env']) {
      const p = join(root, name);
      if (!existsSync(p)) continue;
      for (const line of readFileSync(p, 'utf8').split('\n')) {
        const m = line.match(/^([^#=]+)=(.*)$/);
        if (m && !process.env[m[1].trim()]) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '');
      }
    }
    const client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    const db = client.db(process.env.DB_NAME || 'brushandbloom');
    await db.collection('partner_network_otp_sessions').updateOne(
      { mobile: sharedMobile.replace(/\D/g, '').slice(-10) },
      { $set: { otpHash: hashOtp(testOtp, sharedMobile), expiresAt: new Date(Date.now() + 300000).toISOString(), attempts: 0, mobile: sharedMobile.replace(/\D/g, '').slice(-10) } },
      { upsert: true },
    );
    await client.close();
    const retry = await fetch(`${BASE}/api/partner-network/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mobile: sharedMobile, otp: testOtp }),
    });
    const retryData = await retry.json();
    if (!retry.ok) throw new Error(JSON.stringify(retryData));
    sessionCookie = extractCookie(retry, 'pn_profile_session');
  } else {
    const data = await otpRes.json();
    if (!otpRes.ok) throw new Error(JSON.stringify(data));
    sessionCookie = extractCookie(otpRes, 'pn_profile_session');
  }

  const res = await fetch(`${BASE}/api/partner-network/profile`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Cookie: sessionCookie },
    body: JSON.stringify({
      partnerId: sharedPartnerId,
      mobile: sharedMobile,
      email: sharedEmail,
      operatingAreas: 'Mumbai, Thane',
      dealType: 'both',
      projectsCovered: 'Residential',
      dealsPerMonth: '5',
      city: 'Mumbai',
      state: 'Maharashtra',
      whatsapp: sharedMobile,
      agreementAccepted: true,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(data));
  if (!data.profileCompletionPercent) throw new Error('missing profileCompletionPercent');
  return `${data.profileCompletionPercent}%`;
});

const failed = results.filter((r) => !r.ok);
console.log(JSON.stringify({ passed: results.length - failed.length, failed: failed.length, results }, null, 2));
process.exit(failed.length ? 1 : 0);
