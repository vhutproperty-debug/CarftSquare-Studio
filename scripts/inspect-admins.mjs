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

if (!uri) {
  console.error('No MONGODB_URI in .env.local');
  process.exit(1);
}

const client = new MongoClient(uri);
await client.connect();
const db = client.db(dbName);
const admins = await db.collection('admins').find({}, { projection: { passwordHash: 0 } }).sort({ createdAt: 1 }).toArray();
console.log(JSON.stringify(admins, null, 2));
await client.close();
