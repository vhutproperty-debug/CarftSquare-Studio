import dns from 'node:dns';
import { MongoClient } from 'mongodb';

const globalForMongo = globalThis;

let cachedClient = globalForMongo._mongoCachedClient ?? null;
let cachedDb = globalForMongo._mongoCachedDb ?? null;
let connectPromise = globalForMongo._mongoConnectPromise ?? null;
let resolvedMongoUrl = globalForMongo._mongoResolvedUrl ?? null;

function persistCache() {
  globalForMongo._mongoCachedClient = cachedClient;
  globalForMongo._mongoCachedDb = cachedDb;
  globalForMongo._mongoConnectPromise = connectPromise;
  globalForMongo._mongoResolvedUrl = resolvedMongoUrl;
}

async function resolveSrvMongoUri(srvUri) {
  const match = srvUri.match(/^mongodb\+srv:\/\/([^/]+)(\/.*)?$/i);
  if (!match) return srvUri;

  const authorityAndRest = match[1];
  const pathAndQuery = match[2] || '';
  const hostname = authorityAndRest.includes('@')
    ? authorityAndRest.slice(authorityAndRest.lastIndexOf('@') + 1)
    : authorityAndRest;

  const resolver = new dns.promises.Resolver();
  resolver.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']);
  const records = await resolver.resolveSrv(`_mongodb._tcp.${hostname}`);
  const hosts = records
    .sort((a, b) => a.priority - b.priority || b.weight - a.weight)
    .map((record) => `${record.name.replace(/\.$/, '')}:${record.port}`)
    .join(',');

  const params = new URLSearchParams(pathAndQuery.includes('?') ? pathAndQuery.split('?')[1] : '');
  if (!params.has('ssl')) params.set('ssl', 'true');
  if (!params.has('authSource')) params.set('authSource', 'admin');

  const dbPath = pathAndQuery.split('?')[0] || '';
  const query = params.toString();
  return `mongodb://${authorityAndRest}@${hosts}${dbPath}${query ? `?${query}` : ''}`;
}

async function getConnectableMongoUrl() {
  const configuredUrl = getMongoUrl();
  if (!configuredUrl.startsWith('mongodb+srv://')) {
    return configuredUrl;
  }
  if (resolvedMongoUrl) {
    return resolvedMongoUrl;
  }

  try {
    resolvedMongoUrl = await resolveSrvMongoUri(configuredUrl);
    return resolvedMongoUrl;
  } catch {
    return configuredUrl;
  }
}

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

async function connectOnce() {
  const configError = getDbConfigError();
  if (configError) {
    throw new Error(configError);
  }

  const configuredUrl = getMongoUrl();
  const dbName = getMongoDbName();
  let mongoUrl = await getConnectableMongoUrl();
  let connected = false;
  let lastError = null;

  try {
    cachedClient = new MongoClient(mongoUrl, { serverSelectionTimeoutMS: 8000 });
    await cachedClient.connect();
    connected = true;
  } catch (error) {
    lastError = error;
    const canRetryWithDirectUri = configuredUrl.startsWith('mongodb+srv://') && mongoUrl === configuredUrl;
    if (canRetryWithDirectUri) {
      try {
        mongoUrl = await resolveSrvMongoUri(configuredUrl);
        resolvedMongoUrl = mongoUrl;
        cachedClient = new MongoClient(mongoUrl, { serverSelectionTimeoutMS: 8000 });
        await cachedClient.connect();
        connected = true;
      } catch (retryError) {
        lastError = retryError;
      }
    }
  }

  if (!connected) {
    let hint = 'Check Atlas Network Access (allow your IP or 0.0.0/0) and Database Access user/password.';
    if (/authentication failed|bad auth/i.test(lastError.message)) {
      hint = 'Atlas login failed: wrong username/password, or password needs URL-encoding (e.g. @ becomes %40).';
    }
    if (/querySrv|ECONNREFUSED/i.test(lastError.message)) {
      hint = 'Windows DNS blocked mongodb+srv lookup. Use the direct MongoDB URI from Atlas (Connect → Drivers → “Standard connection string”), or keep MONGODB_URI and restart after this update.';
    }
    throw new Error(
      `Could not connect to MongoDB (${maskMongoUrl(configuredUrl)}). ${hint} Details: ${lastError.message}`,
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
  await cachedDb.collection('quotation_quotes').createIndex({ id: 1 }, { unique: true });
  await cachedDb.collection('quotation_quotes').createIndex({ quoteNumber: 1 }, { unique: true });
  await cachedDb.collection('quotation_quotes').createIndex({ createdAt: -1 });
  await cachedDb.collection('quotation_quotes').createIndex({ moduleId: 1 });
  await cachedDb.collection('quotation_quotes').createIndex({ status: 1 });
  await cachedDb.collection('quotation_settings').createIndex({ key: 1 }, { unique: true });

  persistCache();
  return cachedDb;
}

export async function getDb() {
  if (cachedClient && cachedDb) {
    return cachedDb;
  }

  if (!connectPromise) {
    connectPromise = connectOnce().catch((error) => {
      connectPromise = null;
      cachedClient = null;
      cachedDb = null;
      persistCache();
      throw error;
    });
    persistCache();
  }

  return connectPromise;
}
