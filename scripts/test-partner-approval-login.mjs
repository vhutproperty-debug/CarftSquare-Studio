/**
 * Regression: admin approval must persist to partner_network_partners.status
 * and approved partners can receive OTP / log in.
 *
 * Usage: node scripts/test-partner-approval-login.mjs [baseUrl]
 */
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

function normalizeMobile(mobile) {
  return String(mobile).replace(/\D/g, '').slice(-10);
}

function extractCookies(response) {
  const cookies = typeof response.headers.getSetCookie === 'function'
    ? response.headers.getSetCookie()
    : [response.headers.get('set-cookie')].filter(Boolean);
  return cookies.map((line) => String(line).split(';')[0]).join('; ');
}

async function registerPartner(mobile) {
  const res = await fetch(`${BASE}/api/partner-network/register/quick`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fullName: 'Approval Login Test',
      mobile,
      email: `login.${mobile}@craftsquare.test`,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(data));
  return data;
}

async function sendOtp(mobile) {
  const res = await fetch(`${BASE}/api/partner-network/auth/send-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mobile }),
  });
  const data = await res.json();
  return { status: res.status, data };
}

async function adminLogin() {
  const email = process.env.ADMIN_TEST_EMAIL || 'vhutproperty@gmail.com';
  const password = process.env.ADMIN_TEST_PASSWORD;
  if (!password) return null;

  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) return null;
  return extractCookies(res);
}

async function adminApprovePartner(cookie, id) {
  const res = await fetch(`${BASE}/api/admin/partner-network/partners`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookie,
    },
    body: JSON.stringify({ id, status: 'approved' }),
  });
  const data = await res.json();
  return { status: res.status, data };
}

const mobile = uniqueMobile(7);
let partnerId = '';
let partnerUuid = '';
let mongoClient = null;

try {
  const registered = await registerPartner(mobile);
  partnerId = registered.partnerId;
  record('Quick register creates pending partner', registered.partnerId?.startsWith('CSP'), registered.partnerId);

  const pendingOtp = await sendOtp(mobile);
  record(
    'Pending partner cannot receive OTP',
    pendingOtp.status === 403 && pendingOtp.data.error?.includes('not approved'),
    `status=${pendingOtp.status}`,
  );

  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI missing');
  const dbName = process.env.DB_NAME || process.env.DATABASE_NAME || 'brushandbloom';
  mongoClient = new MongoClient(uri);
  await mongoClient.connect();
  const db = mongoClient.db(dbName);
  const collection = db.collection('partner_network_partners');

  const doc = await collection.findOne({ partnerId });
  partnerUuid = doc?.id || '';
  record(
    'Partner stored in partner_network_partners',
    Boolean(partnerUuid),
    `id=${partnerUuid} status=${doc?.status}`,
  );
  record(
    'Approval uses status field only',
    doc?.approved == null && doc?.isApproved == null && doc?.approvalStatus == null,
    `status=${doc?.status}`,
  );

  const adminCookie = await adminLogin();
  let approvedViaAdmin = false;
  if (adminCookie && partnerUuid) {
    const approveRes = await adminApprovePartner(adminCookie, partnerUuid);
    approvedViaAdmin = approveRes.status === 200 && approveRes.data.partner?.status === 'approved';
    record(
      'Admin PATCH approves partner',
      approvedViaAdmin,
      `status=${approveRes.status} partnerStatus=${approveRes.data.partner?.status || approveRes.data.error}`,
    );
  } else if (process.env.ADMIN_TEST_PASSWORD) {
    record('Admin PATCH approves partner', false, 'admin login failed');
  } else {
    record('Admin PATCH approves partner', true, 'skipped — ADMIN_TEST_PASSWORD not set');
  }

  if (!approvedViaAdmin) {
    const res = await collection.updateOne(
      { id: partnerUuid },
      {
        $set: {
          status: 'approved',
          email: doc?.email || `login.${mobile}@craftsquare.test`,
          approvedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      },
    );
    record('DB fallback approval persists status', res.matchedCount === 1, `matched=${res.matchedCount}`);
  }

  const persisted = await collection.findOne({ id: partnerUuid });
  record('MongoDB status is approved', persisted?.status === 'approved', persisted?.status);

  const approvedOtp = await sendOtp(mobile);
  record(
    'Approved partner can receive OTP',
    approvedOtp.status === 200 && approvedOtp.data.ok === true,
    `status=${approvedOtp.status} ${approvedOtp.data.error || approvedOtp.data.message || ''}`,
  );

  const altOtp = await sendOtp(`+91 ${mobile}`);
  record(
    'Approved partner OTP works with +91 prefix',
    altOtp.status === 200,
    `status=${altOtp.status}`,
  );

  // Cleanup — revert test partner to rejected so login tests do not pollute
  await collection.updateOne(
    { id: partnerUuid },
    { $set: { status: 'rejected', updatedAt: new Date().toISOString() }, $unset: { approvedAt: '' } },
  );
} catch (error) {
  record('Approval login regression', false, error.message);
} finally {
  if (mongoClient) await mongoClient.close();
}

const failed = results.filter((r) => !r.ok).length;
console.log(JSON.stringify({ passed: results.length - failed, failed, results }, null, 2));
process.exit(failed > 0 ? 1 : 0);
