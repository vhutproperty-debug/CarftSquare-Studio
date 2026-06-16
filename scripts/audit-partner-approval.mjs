/**
 * Audit partner approval consistency (DB fields + mobile lookup).
 * Usage: node scripts/audit-partner-approval.mjs
 */
import { MongoClient } from 'mongodb';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

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

function normalizeMobile(mobile) {
  return String(mobile).replace(/\D/g, '').slice(-10);
}

loadEnv();

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error('MONGODB_URI missing');
  process.exit(1);
}

const dbName = process.env.DB_NAME || process.env.DATABASE_NAME || 'brushandbloom';

const client = new MongoClient(uri);
await client.connect();
const db = client.db(dbName);
const partners = await db.collection('partner_network_partners')
  .find({})
  .project({
    _id: 0,
    id: 1,
    partnerId: 1,
    mobile: 1,
    status: 1,
    approvedAt: 1,
    approved: 1,
    isApproved: 1,
    approvalStatus: 1,
  })
  .toArray();

console.log(`Total partners: ${partners.length}\n`);

for (const p of partners) {
  const normalized = normalizeMobile(p.mobile);
  const lookup = await db.collection('partner_network_partners').findOne({ mobile: normalized });
  console.log(JSON.stringify({
    partnerId: p.partnerId,
    id: p.id,
    mobile: p.mobile,
    normalized,
    mobileStoredNormalized: p.mobile === normalized,
    status: p.status,
    approvedAt: p.approvedAt || null,
    legacyFields: {
      approved: p.approved ?? null,
      isApproved: p.isApproved ?? null,
      approvalStatus: p.approvalStatus ?? null,
    },
    loginLookupMatchesSelf: lookup?.id === p.id,
    loginLookupStatus: lookup?.status ?? null,
  }));
}

await client.close();
