import { v4 as uuidv4 } from 'uuid';
import type { Db } from 'mongodb';
import { getDb } from '@/lib/mongodb';
import { isValidIndianMobile, normalizeIndianMobile } from '@/lib/phone/indian-mobile';
import { AURIS_LEAD_SOURCE } from './constants';
import type { AurisSerenityLead, AurisUtmParams } from './types';

const COLLECTION = 'auris_serenity_leads';

export async function getAurisSerenityDatabase(): Promise<Db> {
  return getDb();
}

export async function ensureAurisSerenityLeadIndexes(db: Db): Promise<void> {
  await db.collection(COLLECTION).createIndex({ id: 1 }, { unique: true });
  await db.collection(COLLECTION).createIndex({ createdAt: -1 });
  await db.collection(COLLECTION).createIndex({ mobile: 1 });
  await db.collection(COLLECTION).createIndex({ source: 1 });
  await db.collection(COLLECTION).createIndex({ selectedIntent: 1 });
}

export function normalizeAurisMobile(mobile: string): string {
  return normalizeIndianMobile(mobile);
}

export function isValidAurisMobile(mobile: string): boolean {
  return isValidIndianMobile(mobile);
}

export async function findRecentAurisLeadByMobile(
  db: Db,
  mobile: string,
  withinMinutes = 30,
): Promise<AurisSerenityLead | null> {
  const digits = normalizeAurisMobile(mobile);
  if (!digits) return null;
  const since = new Date(Date.now() - withinMinutes * 60 * 1000).toISOString();
  const leads = (await db
    .collection(COLLECTION)
    .find({ createdAt: { $gte: since }, mobile: digits }, { projection: { _id: 0 } })
    .sort({ createdAt: -1 })
    .limit(1)
    .toArray()) as unknown as AurisSerenityLead[];
  return leads[0] || null;
}

export async function createAurisSerenityLead(
  db: Db,
  payload: {
    name: string;
    mobile: string;
    selectedIntent: string;
    possessionTimeline: string;
    pagePath?: string;
    referrer?: string;
    utm?: AurisUtmParams;
  },
): Promise<AurisSerenityLead> {
  const now = new Date().toISOString();
  const lead: AurisSerenityLead = {
    id: uuidv4(),
    name: payload.name.trim(),
    mobile: payload.mobile,
    selectedIntent: payload.selectedIntent,
    possessionTimeline: payload.possessionTimeline,
    source: AURIS_LEAD_SOURCE,
    pagePath: payload.pagePath?.trim() || '/auris-serenity',
    referrer: payload.referrer?.trim() || '',
    utm: payload.utm || {},
    status: 'new',
    notes: '',
    createdAt: now,
    updatedAt: now,
  };
  await db.collection(COLLECTION).insertOne(lead);
  return lead;
}
