import { v4 as uuidv4 } from 'uuid';
import type { Db } from 'mongodb';
import { getDb } from '@/lib/mongodb';
import { isValidIndianMobile, normalizeIndianMobile } from '@/lib/phone/indian-mobile';
import { SATELLITE_LEAD_SOURCE } from './constants';
import type { SatelliteEleganceLead, SatelliteUtmParams } from './types';

const COLLECTION = 'satellite_elegance_leads';

export async function getSatelliteEleganceDatabase(): Promise<Db> {
  return getDb();
}

export async function ensureSatelliteEleganceLeadIndexes(db: Db): Promise<void> {
  await db.collection(COLLECTION).createIndex({ id: 1 }, { unique: true });
  await db.collection(COLLECTION).createIndex({ createdAt: -1 });
  await db.collection(COLLECTION).createIndex({ mobile: 1 });
  await db.collection(COLLECTION).createIndex({ source: 1 });
  await db.collection(COLLECTION).createIndex({ selectedIntent: 1 });
}

export function normalizeSatelliteMobile(mobile: string): string {
  return normalizeIndianMobile(mobile);
}

export function isValidSatelliteMobile(mobile: string): boolean {
  return isValidIndianMobile(mobile);
}

export async function findRecentSatelliteLeadByMobile(
  db: Db,
  mobile: string,
  withinMinutes = 30,
): Promise<SatelliteEleganceLead | null> {
  const digits = normalizeSatelliteMobile(mobile);
  if (!digits) return null;
  const since = new Date(Date.now() - withinMinutes * 60 * 1000).toISOString();
  const leads = (await db
    .collection(COLLECTION)
    .find({ createdAt: { $gte: since }, mobile: digits }, { projection: { _id: 0 } })
    .sort({ createdAt: -1 })
    .limit(1)
    .toArray()) as unknown as SatelliteEleganceLead[];
  return leads[0] || null;
}

export async function createSatelliteEleganceLead(
  db: Db,
  payload: {
    name: string;
    mobile: string;
    selectedIntent: string;
    possessionTimeline: string;
    pagePath?: string;
    referrer?: string;
    utm?: SatelliteUtmParams;
  },
): Promise<SatelliteEleganceLead> {
  const now = new Date().toISOString();
  const lead: SatelliteEleganceLead = {
    id: uuidv4(),
    name: payload.name.trim(),
    mobile: payload.mobile,
    selectedIntent: payload.selectedIntent,
    possessionTimeline: payload.possessionTimeline,
    source: SATELLITE_LEAD_SOURCE,
    pagePath: payload.pagePath?.trim() || '/satellite-elegance',
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
