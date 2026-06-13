/**
 * Fix super_admin role in MongoDB and verify auth payload shape.
 * Run: node scripts/fix-super-admin.mjs
 */
import { readFileSync } from 'fs';
import { MongoClient } from 'mongodb';

function loadEnv() {
  try {
    const raw = readFileSync('.env.local', 'utf8');
    for (const line of raw.split('\n')) {
      const m = line.match(/^([^#=]+)=(.*)$/);
      if (m && !process.env[m[1].trim()]) {
        process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '');
      }
    }
  } catch {
    // ignore
  }
}

loadEnv();

const TARGET_EMAIL = 'vhutproperty@gmail.com';
const uri = process.env.MONGODB_URI || process.env.MONGO_URL;
const dbName = process.env.DB_NAME || process.env.DATABASE_NAME || 'brushandbloom';

if (!uri) {
  console.error('No MONGODB_URI in .env.local');
  process.exit(1);
}

const client = new MongoClient(uri);
await client.connect();
const db = client.db(dbName);
const now = new Date().toISOString();

const all = await db.collection('admins').find({}).sort({ createdAt: 1 }).toArray();
const superAdmins = all.filter((a) => a.role === 'super_admin');

if (!superAdmins.length) {
  const target = all.find((a) => a.email?.toLowerCase() === TARGET_EMAIL) || all[0];
  if (target) {
    await db.collection('admins').updateOne(
      { id: target.id },
      { $set: { role: 'super_admin', status: 'active', updatedAt: now } },
    );
    console.log(`[rbac] Promoted ${target.email} to super_admin`);
  }
} else {
  const target = all.find((a) => a.email?.toLowerCase() === TARGET_EMAIL);
  if (target && target.role !== 'super_admin') {
    await db.collection('admins').updateOne(
      { id: target.id },
      { $set: { role: 'super_admin', status: 'active', updatedAt: now } },
    );
    console.log(`[rbac] Updated ${TARGET_EMAIL} to super_admin`);
  }
}

const fixed = await db.collection('admins').findOne(
  { email: TARGET_EMAIL },
  { projection: { passwordHash: 0, _id: 0 } },
);
console.log('[rbac] Verified admin record:', JSON.stringify(fixed, null, 2));
await client.close();
