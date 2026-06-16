/**
 * Safe Partner Network DB setup — creates indexes only (no data deletion).
 * Usage: node scripts/ensure-partner-network-indexes.mjs
 */
import { MongoClient } from 'mongodb';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const C = {
  PARTNERS: 'partner_network_partners',
  LEADS: 'partner_network_leads',
  COMMISSIONS: 'partner_network_commissions',
  PAYMENTS: 'partner_network_payments',
  ACTIVITY: 'partner_network_activity_logs',
  SETTINGS: 'partner_network_settings',
  OTP: 'partner_network_otp_sessions',
  MANAGERS: 'partner_network_managers',
};

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

const uri = process.env.MONGODB_URI || process.env.DATABASE_URL;
const dbName = process.env.DB_NAME || process.env.DATABASE_NAME || 'brushandbloom';
if (!uri) {
  console.error(JSON.stringify({ ok: false, error: 'MONGODB_URI or DATABASE_URL required' }));
  process.exit(1);
}

const client = new MongoClient(uri);
try {
  await client.connect();
  const db = client.db(dbName);

  await db.collection(C.PARTNERS).createIndex({ id: 1 }, { unique: true });
  await db.collection(C.PARTNERS).createIndex({ partnerId: 1 }, { unique: true });
  await db.collection(C.PARTNERS).createIndex({ mobile: 1 }, { unique: true });
  await db.collection(C.PARTNERS).createIndex({ email: 1 });
  await db.collection(C.PARTNERS).createIndex({ status: 1, createdAt: -1 });
  await db.collection(C.PARTNERS).createIndex({ registrationStatus: 1, createdAt: -1 });
  await db.collection(C.PARTNERS).createIndex({ status: 1, registrationStatus: 1 });
  await db.collection(C.LEADS).createIndex({ id: 1 }, { unique: true });
  await db.collection(C.LEADS).createIndex({ leadId: 1 }, { unique: true });
  await db.collection(C.LEADS).createIndex({ mobile: 1 });
  await db.collection(C.LEADS).createIndex({ partnerId: 1, createdAt: -1 });
  await db.collection(C.LEADS).createIndex({ status: 1, createdAt: -1 });
  await db.collection(C.COMMISSIONS).createIndex({ id: 1 }, { unique: true });
  await db.collection(C.COMMISSIONS).createIndex({ partnerId: 1, createdAt: -1 });
  await db.collection(C.PAYMENTS).createIndex({ id: 1 }, { unique: true });
  await db.collection(C.ACTIVITY).createIndex({ id: 1 }, { unique: true });
  await db.collection(C.ACTIVITY).createIndex({ createdAt: -1 });
  await db.collection(C.ACTIVITY).createIndex({ 'details.partnerId': 1, createdAt: -1 });
  await db.collection(C.ACTIVITY).createIndex({ entityType: 1, entityId: 1, createdAt: -1 });
  await db.collection(C.SETTINGS).createIndex({ key: 1 }, { unique: true });
  await db.collection(C.OTP).createIndex({ mobile: 1 }, { unique: true });
  await db.collection(C.OTP).createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  await db.collection(C.MANAGERS).createIndex({ id: 1 }, { unique: true });

  console.log(JSON.stringify({
    ok: true,
    migration: 'indexes_only',
    dbName,
    message: 'Partner Network indexes ensured. No documents modified.',
  }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : error }));
  process.exit(1);
} finally {
  await client.close();
}
