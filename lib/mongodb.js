import { MongoClient } from 'mongodb';

let cachedClient = null;
let cachedDb = null;

/** Prefer MONGODB_URI (Atlas/Vercel) over MONGO_URL (local legacy). */
export function getMongoUrl() {
  return String(process.env.MONGODB_URI || process.env.MONGO_URL || '').trim();
}

export function getMongoDbName() {
  if (process.env.DB_NAME) return process.env.DB_NAME;
  if (process.env.DATABASE_NAME) return process.env.DATABASE_NAME;
  const mongoUrl = getMongoUrl();
  if (!mongoUrl) return null;
  try {
    const parsed = new URL(mongoUrl);
    const fromPath = String(parsed.pathname || '').replace(/^\//, '').split('/')[0];
    if (fromPath) return fromPath;
  } catch {
    const match = mongoUrl.match(/mongodb(?:\+srv)?:\/\/[^/]+\/([^/?]+)/i);
    if (match) return match[1];
  }
  return 'brushandbloom';
}

export function getDbConfigError() {
  const mongoUrl = getMongoUrl();
  if (!mongoUrl) {
    return 'MONGODB_URI (or MONGO_URL) is not set. Add your Atlas connection string to .env.local and restart npm run dev.';
  }
  if (mongoUrl.includes('YOUR_PASSWORD') || mongoUrl.includes('<password>')) {
    return 'Replace YOUR_PASSWORD in MONGODB_URI with your real Atlas password (URL-encoded if it has special characters).';
  }
  if (!getMongoDbName()) {
    return 'DB_NAME is not configured. Set DB_NAME=brushandbloom in .env.local.';
  }
  return null;
}

export function maskMongoUrl(mongoUrl = '') {
  return mongoUrl.replace(/\/\/([^@/]+@)?/, '//***@');
}

export async function getDb() {
  if (cachedClient && cachedDb) {
    return cachedDb;
  }

  const configError = getDbConfigError();
  if (configError) {
    throw new Error(configError);
  }

  const mongoUrl = getMongoUrl();
  const dbName = getMongoDbName();

  try {
    cachedClient = new MongoClient(mongoUrl, { serverSelectionTimeoutMS: 8000 });
    await cachedClient.connect();
  } catch (error) {
    let hint = 'Check Atlas Network Access (allow your IP or 0.0.0.0/0) and Database Access user/password.';
    if (/authentication failed|bad auth/i.test(error.message)) {
      hint = 'Atlas login failed: wrong username/password, or password needs URL-encoding (e.g. @ becomes %40).';
    }
    throw new Error(
      `Could not connect to MongoDB (${maskMongoUrl(mongoUrl)}). ${hint} Details: ${error.message}`,
    );
  }

  cachedDb = cachedClient.db(dbName);
  await cachedDb.collection('leads').createIndex({ id: 1 }, { unique: true });
  await cachedDb.collection('leads').createIndex({ createdAt: -1 });
  await cachedDb.collection('leads').createIndex({ status: 1 });
  await cachedDb.collection('admins').createIndex({ id: 1 }, { unique: true });
  await cachedDb.collection('admins').createIndex({ email: 1 }, { unique: true });
  await cachedDb.collection('quotes').createIndex({ id: 1 }, { unique: true });
  await cachedDb.collection('settings').createIndex({ key: 1 }, { unique: true });
  await cachedDb.collection('vendors').createIndex({ id: 1 }, { unique: true });
  await cachedDb.collection('vendors').createIndex({ status: 1 });
  await cachedDb.collection('vendors').createIndex({ createdAt: -1 });
  await cachedDb.collection('whatsapp_messages').createIndex({ createdAt: -1 });
  await cachedDb.collection('paint_shades').createIndex({ id: 1 }, { unique: true });
  await cachedDb.collection('paint_shades').createIndex({ brand: 1, shadeCode: 1 }, { unique: true });
  await cachedDb.collection('paint_shades').createIndex({ brand: 1 });
  await cachedDb.collection('paint_shades').createIndex({ category: 1 });
  await cachedDb.collection('email_notifications').createIndex({ id: 1 }, { unique: true });
  await cachedDb.collection('email_notifications').createIndex({ status: 1, attempts: 1, createdAt: -1 });
  await cachedDb.collection('enquiry_events').createIndex({ createdAt: -1 });

  return cachedDb;
}
