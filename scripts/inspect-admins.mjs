import { MongoClient } from 'mongodb';
import { loadEnvLocal } from './lib/load-env-local.mjs';

loadEnvLocal();

const uri = process.env.MONGODB_URI || process.env.MONGO_URL;
const dbName = process.env.DB_NAME || process.env.DATABASE_NAME || 'brushandbloom';

if (!uri) {
  console.error('No MONGODB_URI in .env.local');
  process.exit(1);
}

const client = new MongoClient(uri);
await client.connect();
const db = client.db(dbName);
const admins = await db
  .collection('admins')
  .find({}, { projection: { email: 1, name: 1, role: 1, status: 1, _id: 0 } })
  .sort({ createdAt: 1 })
  .toArray();
console.log(JSON.stringify(admins, null, 2));
await client.close();
