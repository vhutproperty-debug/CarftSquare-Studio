import dns from 'node:dns';
import { MongoClient } from 'mongodb';
import { getMongoConnectionCache } from './mongo-client-cache';

/**
 * Pool and handshake budgets for serverless cold starts.
 * serverSelectionTimeoutMS stays under AUTH_DB_TIMEOUT_MS (12s).
 */
export const MONGO_CLIENT_OPTIONS = {
  maxPoolSize: 10,
  serverSelectionTimeoutMS: 5000,
  connectTimeoutMS: 10000,
  maxIdleTimeMS: 120000,
};

const INDEX_WAIT_MS = 1500;

function withDeadline(promise, ms, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${ms}ms`));
    }, ms);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
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
  const records = await withDeadline(
    resolver.resolveSrv(`_mongodb._tcp.${hostname}`),
    2500,
    'mongodb SRV lookup',
  );
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

function getResolvedMongoUrl() {
  return globalThis.__craftsquareMongoResolvedUrl || null;
}

function setResolvedMongoUrl(url) {
  globalThis.__craftsquareMongoResolvedUrl = url;
}

async function getConnectableMongoUrl() {
  const configuredUrl = getMongoUrl();
  if (!configuredUrl.startsWith('mongodb+srv://')) {
    return configuredUrl;
  }
  const cached = getResolvedMongoUrl();
  if (cached) return cached;

  try {
    const resolved = await resolveSrvMongoUri(configuredUrl);
    setResolvedMongoUrl(resolved);
    return resolved;
  } catch {
    return configuredUrl;
  }
}

/** Prefer MONGODB_URI (Atlas/Vercel) over MONGO_URL (local legacy). */
export function getMongoUrl() {
  return String(process.env.MONGODB_URI || process.env.DATABASE_URL || process.env.MONGO_URL || '').trim();
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

async function openClient(url) {
  const client = new MongoClient(url, MONGO_CLIENT_OPTIONS);
  try {
    await client.connect();
    return client;
  } catch (error) {
    await client.close().catch(() => undefined);
    throw error;
  }
}

async function ensureMongoIndexes(db) {
  await db.collection('leads').createIndex({ id: 1 }, { unique: true });
  await db.collection('leads').createIndex({ createdAt: -1 });
  await db.collection('leads').createIndex({ status: 1 });
  await db.collection('admins').createIndex({ id: 1 }, { unique: true });
  await db.collection('admins').createIndex({ email: 1 }, { unique: true });
  await db.collection('admins').createIndex({ role: 1, status: 1 });
  await db.collection('admin_activity_logs').createIndex({ id: 1 }, { unique: true });
  await db.collection('admin_activity_logs').createIndex({ createdAt: -1 });
  await db.collection('admin_activity_logs').createIndex({ actorId: 1, createdAt: -1 });
  await db.collection('admin_activity_logs').createIndex({ action: 1, createdAt: -1 });
  await db.collection('quotes').createIndex({ id: 1 }, { unique: true });
  await db.collection('settings').createIndex({ key: 1 }, { unique: true });
  await db.collection('vendors').createIndex({ id: 1 }, { unique: true });
  await db.collection('vendors').createIndex({ status: 1 });
  await db.collection('vendors').createIndex({ createdAt: -1 });
  await db.collection('whatsapp_messages').createIndex({ createdAt: -1 });
  await db.collection('paint_shades').createIndex({ id: 1 }, { unique: true });
  await db.collection('paint_shades').createIndex({ brand: 1, shadeCode: 1 }, { unique: true });
  await db.collection('paint_shades').createIndex({ brand: 1 });
  await db.collection('paint_shades').createIndex({ category: 1 });
  await db.collection('email_notifications').createIndex({ id: 1 }, { unique: true });
  await db.collection('email_notifications').createIndex({ status: 1, attempts: 1, createdAt: -1 });
  await db.collection('enquiry_events').createIndex({ createdAt: -1 });
  await db.collection('quotation_quotes').createIndex({ id: 1 }, { unique: true });
  await db.collection('quotation_quotes').createIndex({ quoteNumber: 1 }, { unique: true });
  await db.collection('quotation_quotes').createIndex({ createdAt: -1 });
  await db.collection('quotation_quotes').createIndex({ moduleId: 1 });
  await db.collection('quotation_quotes').createIndex({ status: 1 });
  await db.collection('quotation_settings').createIndex({ key: 1 }, { unique: true });
  await db.collection('designer_callback_leads').createIndex({ id: 1 }, { unique: true });
  await db.collection('designer_callback_leads').createIndex({ createdAt: -1 });
  await db.collection('designer_callback_leads').createIndex({ status: 1 });
  await db.collection('designer_callback_leads').createIndex({ phone: 1 });
  await db.collection('customer_reviews').createIndex({ id: 1 }, { unique: true });
  await db.collection('customer_reviews').createIndex({ status: 1 });
  await db.collection('customer_reviews').createIndex({ createdAt: -1 });
  await db.collection('quotation_consultations').createIndex({ id: 1 }, { unique: true });
  await db.collection('quotation_consultations').createIndex({ createdAt: -1 });
  await db.collection('blog_posts').createIndex({ id: 1 }, { unique: true });
  await db.collection('blog_posts').createIndex({ slug: 1 }, { unique: true });
  await db.collection('blog_posts').createIndex({ status: 1, publishedAt: -1 });
  await db.collection('blog_posts').createIndex({ status: 1, category: 1, publishedAt: -1 });
  await db.collection('blog_posts').createIndex({ status: 1, tags: 1, publishedAt: -1 });

  const { ensurePartnerNetworkIndexes } = await import('@/lib/partner-network/store');
  await ensurePartnerNetworkIndexes(db);
}

function scheduleMongoIndexes(db) {
  const root = globalThis;
  if (root.__craftsquareMongoIndexes) return root.__craftsquareMongoIndexes;
  root.__craftsquareMongoIndexes = ensureMongoIndexes(db).catch((error) => {
    root.__craftsquareMongoIndexes = null;
    console.error('[mongo] ensure_indexes_failed', error instanceof Error ? error.message : error);
  });
  return root.__craftsquareMongoIndexes;
}

async function connectOnce() {
  const configError = getDbConfigError();
  if (configError) {
    throw new Error(configError);
  }

  const configuredUrl = getMongoUrl();
  const dbName = getMongoDbName();
  let mongoUrl = await getConnectableMongoUrl();
  let client = null;
  let lastError = null;

  try {
    client = await openClient(mongoUrl);
  } catch (error) {
    lastError = error;
    const canRetryWithDirectUri = configuredUrl.startsWith('mongodb+srv://') && mongoUrl === configuredUrl;
    if (canRetryWithDirectUri) {
      try {
        mongoUrl = await resolveSrvMongoUri(configuredUrl);
        setResolvedMongoUrl(mongoUrl);
        client = await openClient(mongoUrl);
      } catch (retryError) {
        lastError = retryError;
        client = null;
      }
    }
  }

  if (!client) {
    let hint = 'Check Atlas Network Access (allow your IP or 0.0.0/0) and Database Access user/password.';
    const detail = lastError instanceof Error ? lastError.message : String(lastError || 'unknown error');
    if (/authentication failed|bad auth/i.test(detail)) {
      hint = 'Atlas login failed: wrong username/password, or password needs URL-encoding (e.g. @ becomes %40).';
    }
    if (/querySrv|ECONNREFUSED/i.test(detail)) {
      hint = 'Windows DNS blocked mongodb+srv lookup. Use the direct MongoDB URI from Atlas (Connect → Drivers → “Standard connection string”), or keep MONGODB_URI and restart after this update.';
    }
    throw new Error(
      `Could not connect to MongoDB (${maskMongoUrl(configuredUrl)}). ${hint} Details: ${detail}`,
    );
  }

  const db = client.db(dbName);
  // Index builds are once per isolate and must not hold auth hostage on a cold start.
  const indexes = scheduleMongoIndexes(db);
  await Promise.race([
    indexes,
    new Promise((resolve) => {
      setTimeout(resolve, INDEX_WAIT_MS);
    }),
  ]);
  return { client, db };
}

export async function getDb() {
  const db = await getMongoConnectionCache().getDb(connectOnce);
  if (!globalThis.__craftsquareMongoIndexes) {
    scheduleMongoIndexes(db);
  }
  return db;
}

/** True when the process already holds a connected Mongo client + db (warm isolate). */
export function isMongoReady() {
  return getMongoConnectionCache().hasClient();
}
