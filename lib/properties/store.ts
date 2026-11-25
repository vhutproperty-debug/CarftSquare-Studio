import { v4 as uuidv4 } from 'uuid';
import type { Db } from 'mongodb';
import {
  PROPERTIES_BRAND_NAME,
  PROPERTIES_CONSENT_TEXT,
  PROPERTIES_CONSENT_VERSION,
  PROPERTIES_LEADS_COLLECTION,
  PROPERTIES_LEAD_SOURCE,
  PROPERTIES_PAGE_PATH,
  getPropertiesIntentLabel,
} from './constants';
import type { PropertiesLead, PropertiesUtmParams } from './types';

const COLLECTION = PROPERTIES_LEADS_COLLECTION;

/** Additive indexes on a new collection. Nothing existing is touched. */
export async function ensurePropertiesLeadIndexes(db: Db): Promise<void> {
  await db.collection(COLLECTION).createIndex({ id: 1 }, { unique: true });
  await db.collection(COLLECTION).createIndex({ createdAt: -1 });
  await db.collection(COLLECTION).createIndex({ mobile: 1 });
  await db.collection(COLLECTION).createIndex({ ip: 1, createdAt: -1 });
}

function sinceIso(minutes: number): string {
  return new Date(Date.now() - minutes * 60 * 1000).toISOString();
}

export async function countRecentPropertiesLeadsByIp(db: Db, ip: string, withinMinutes: number): Promise<number> {
  if (!ip || ip === 'unknown') return 0;
  return db.collection(COLLECTION).countDocuments({ ip, createdAt: { $gte: sinceIso(withinMinutes) } });
}

export async function findRecentPropertiesLeadByMobile(
  db: Db,
  mobile: string,
  withinMinutes: number,
): Promise<PropertiesLead | null> {
  if (!mobile) return null;
  const docs = (await db
    .collection(COLLECTION)
    .find({ mobile, createdAt: { $gte: sinceIso(withinMinutes) } }, { projection: { _id: 0 } })
    .sort({ createdAt: -1 })
    .limit(1)
    .toArray()) as unknown as PropertiesLead[];
  return docs[0] || null;
}

export async function createPropertiesLead(
  db: Db,
  payload: {
    name: string;
    mobile: string;
    email?: string;
    intent: string;
    area?: string;
    budget?: string;
    message?: string;
    pagePath?: string;
    referrer?: string;
    utm?: PropertiesUtmParams;
    ip: string;
    userAgent: string;
  },
): Promise<PropertiesLead> {
  const now = new Date().toISOString();
  const pagePath = payload.pagePath?.trim() || PROPERTIES_PAGE_PATH;
  const lead: PropertiesLead = {
    id: uuidv4(),
    name: payload.name.trim(),
    mobile: payload.mobile,
    email: String(payload.email || '').trim(),
    intent: payload.intent,
    intentLabel: getPropertiesIntentLabel(payload.intent),
    area: String(payload.area || '').trim(),
    budget: String(payload.budget || '').trim(),
    message: String(payload.message || '').trim(),
    brand: PROPERTIES_BRAND_NAME,
    source: PROPERTIES_LEAD_SOURCE,
    pagePath,
    referrer: String(payload.referrer || '').trim(),
    utm: payload.utm || {},
    ip: payload.ip,
    userAgent: payload.userAgent,
    consent: {
      given: true,
      text: PROPERTIES_CONSENT_TEXT,
      version: PROPERTIES_CONSENT_VERSION,
      channels: ['call', 'sms', 'whatsapp', 'rcs'],
      timestamp: now,
      ip: payload.ip,
      userAgent: payload.userAgent,
      pagePath,
    },
    status: 'new',
    notes: '',
    createdAt: now,
    updatedAt: now,
  };
  await db.collection(COLLECTION).insertOne({ ...lead });
  return lead;
}
