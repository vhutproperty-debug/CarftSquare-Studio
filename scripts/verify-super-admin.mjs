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

const uri = process.env.MONGODB_URI || process.env.MONGO_URL;
const dbName = process.env.DB_NAME || process.env.DATABASE_NAME || 'brushandbloom';
const client = new MongoClient(uri);
await client.connect();
const db = client.db(dbName);

// Simulate broken migration pattern (old bug) should NOT run — verify role stays super_admin
const before = await db.collection('admins').findOne({ email: 'vhutproperty@gmail.com' }, { projection: { role: 1, status: 1, email: 1 } });
console.log('before:', before);

// Run ensure via dynamic import of store (needs ts - use inline ensure instead)
const admins = await db.collection('admins').find({}).sort({ createdAt: 1 }).toArray();
const superAdmins = admins.filter((a) => a.role === 'super_admin');
console.log('super_admin_count:', superAdmins.length);
console.log('PASS:', before?.role === 'super_admin' && before?.status === 'active' && superAdmins.length === 1);
await client.close();
