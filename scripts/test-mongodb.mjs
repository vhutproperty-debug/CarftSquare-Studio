import { MongoClient } from 'mongodb';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

function loadEnvLocal() {
  const envPath = resolve(process.cwd(), '.env.local');
  if (!existsSync(envPath)) {
    console.error('Missing .env.local — create it from .env.example');
    process.exit(1);
  }
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvLocal();

const uri = process.env.MONGODB_URI || process.env.MONGO_URL || '';
const dbName = process.env.DB_NAME || 'brushandbloom';

if (!uri) {
  console.error('FAIL: Set MONGODB_URI in .env.local');
  process.exit(1);
}
if (uri.includes('YOUR_PASSWORD')) {
  console.error('FAIL: Replace YOUR_PASSWORD in MONGODB_URI with your real Atlas password');
  process.exit(1);
}
if (process.env.MONGO_URL && process.env.MONGODB_URI) {
  console.warn('WARN: Both MONGO_URL and MONGODB_URI are set. The app uses MONGODB_URI first.');
}

console.log('Testing MongoDB connection...');
console.log('Database:', dbName);

const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10000 });
try {
  await client.connect();
  const db = client.db(dbName);
  const adminCount = await db.collection('admins').countDocuments({ role: 'admin' });
  console.log('OK: Connected to MongoDB Atlas/local');
  console.log('Admin accounts in database:', adminCount);
  if (adminCount === 0) {
    console.log('TIP: No admin yet — open /admin and use "Create First Admin"');
  } else {
    const admin = await db.collection('admins').findOne({ role: 'admin' }, { projection: { email: 1, name: 1, _id: 0 } });
    console.log('Existing admin email:', admin?.email || '(unknown)');
  }
} catch (error) {
  console.error('FAIL:', error.message);
  process.exit(1);
} finally {
  await client.close();
}
