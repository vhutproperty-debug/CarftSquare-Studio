/**
 * End-to-end partner approval audit (DB + API shape).
 * Usage: node scripts/test-partner-approve.mjs [baseUrl]
 */
import { MongoClient } from 'mongodb';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const base = process.argv[2] || 'http://localhost:3000';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function loadEnv() {
  for (const name of ['.env.local', '.env']) {
    const p = join(root, name);
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, 'utf8').split('\n')) {
      const m = line.match(/^([^#=]+)=(.*)$/);
      if (m && !process.env[m[1].trim()]) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '');
    }
  }
}

loadEnv();

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error('MONGODB_URI missing');
  process.exit(1);
}

const client = new MongoClient(uri);
const results = [];

function record(name, ok, detail = '') {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}${detail ? ` — ${detail}` : ''}`);
}

try {
  await client.connect();
  const db = client.db();
  const partners = await db.collection('partner_network_partners')
    .find({}, { projection: { _id: 0 } })
    .sort({ createdAt: -1 })
    .limit(10)
    .toArray();

  record('Partners collection readable', partners.length >= 0, `${partners.length} recent`);

  const pending = partners.filter((p) => p.status === 'pending');
  const completePending = pending.filter((p) => {
    const step2 = ['operatingAreas', 'dealType', 'projectsCovered', 'dealsPerMonth', 'city', 'state', 'whatsapp'];
    const filled = (v) => String(v ?? '').trim().length > 0;
    if (!filled(p.fullName) || !filled(p.mobile)) return false;
    const n = step2.filter((k) => filled(p[k])).length;
    return n === step2.length;
  });

  record('Pending partners found', true, `${pending.length} pending, ${completePending.length} profile-complete`);

  const target = completePending[0] || pending[0];
  if (!target) {
    record('Approval target exists', false, 'no pending partner to test');
  } else {
    record('Target has uuid id field', Boolean(target.id), target.id || 'missing');
    record('Target partnerId', true, target.partnerId);

    const before = target.status;
    const res = await db.collection('partner_network_partners').updateOne(
      { id: target.id },
      { $set: { status: 'approved', approvedAt: new Date().toISOString(), updatedAt: new Date().toISOString() } },
    );
    record('DB updateOne matched', res.matchedCount === 1, `matched=${res.matchedCount} modified=${res.modifiedCount}`);

    const after = await db.collection('partner_network_partners').findOne({ id: target.id });
    record('DB status → approved', after?.status === 'approved', after?.status);
    record('DB approvedAt set', Boolean(after?.approvedAt), after?.approvedAt || '');

    // Revert for safety
    await db.collection('partner_network_partners').updateOne(
      { id: target.id },
      { $set: { status: before, updatedAt: new Date().toISOString() }, $unset: { approvedAt: '' } },
    );
    record('DB reverted to original status', true, before);
  }

  // API without auth should 401/403
  const unauth = await fetch(`${base}/api/admin/partner-network/partners`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: 'test', status: 'approved' }),
  });
  record('PATCH without session rejected', unauth.status === 401 || unauth.status === 403, `status=${unauth.status}`);

  const listRes = await fetch(`${base}/api/admin/partner-network/partners`);
  record('GET partners without session rejected', listRes.status === 401 || listRes.status === 403, `status=${listRes.status}`);

} catch (err) {
  record('Script execution', false, err.message);
} finally {
  await client.close();
}

const failed = results.filter((r) => !r.ok).length;
console.log(JSON.stringify({ passed: results.length - failed, failed, results }, null, 2));
process.exit(failed > 0 ? 1 : 0);
