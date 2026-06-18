import { v4 as uuidv4 } from 'uuid';
import type { Db } from 'mongodb';
import type { PartnerCallbackRequest, PartnerCallbackStatus } from './types';

const COLLECTION = 'callback_requests';
const SOURCE = 'Partner Network';
const DUPLICATE_WINDOW_MS = 24 * 60 * 60 * 1000;

export function normalizeCallbackMobile(mobile: string): string {
  return mobile.replace(/\D/g, '').slice(-10);
}

export function isValidCallbackMobile(mobile: string): boolean {
  const digits = normalizeCallbackMobile(mobile);
  return /^[6-9]\d{9}$/.test(digits);
}

export async function ensureCallbackRequestIndexes(db: Db): Promise<void> {
  await db.collection(COLLECTION).createIndex({ id: 1 }, { unique: true });
  await db.collection(COLLECTION).createIndex({ createdAt: -1 });
  await db.collection(COLLECTION).createIndex({ status: 1 });
  await db.collection(COLLECTION).createIndex({ mobile: 1 });
  await db.collection(COLLECTION).createIndex({ source: 1 });
}

export async function findRecentCallbackByMobile(
  db: Db,
  mobile: string,
): Promise<PartnerCallbackRequest | null> {
  const digits = normalizeCallbackMobile(mobile);
  if (!digits) return null;
  const since = new Date(Date.now() - DUPLICATE_WINDOW_MS).toISOString();
  const rows = (await db
    .collection(COLLECTION)
    .find(
      { createdAt: { $gte: since }, mobile: { $regex: digits } },
      { projection: { _id: 0 } },
    )
    .sort({ createdAt: -1 })
    .limit(1)
    .toArray()) as PartnerCallbackRequest[];
  return rows[0] || null;
}

export async function createCallbackRequest(
  db: Db,
  payload: { name?: string; mobile: string },
): Promise<PartnerCallbackRequest> {
  const now = new Date().toISOString();
  const digits = normalizeCallbackMobile(payload.mobile);
  const record: PartnerCallbackRequest = {
    id: uuidv4(),
    name: payload.name?.trim() || undefined,
    mobile: digits,
    source: SOURCE,
    status: 'pending',
    createdAt: now,
    updatedAt: now,
  };
  await db.collection(COLLECTION).insertOne(record);
  return record;
}

export async function listCallbackRequests(
  db: Db,
  filters: { q?: string; status?: PartnerCallbackStatus } = {},
  limit = 500,
): Promise<PartnerCallbackRequest[]> {
  const query: Record<string, unknown> = { source: SOURCE };
  if (filters.status) query.status = filters.status;

  let rows = (await db
    .collection(COLLECTION)
    .find(query, { projection: { _id: 0 } })
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray()) as PartnerCallbackRequest[];

  const q = filters.q?.trim().toLowerCase();
  if (q) {
    rows = rows.filter((row) => {
      const haystack = [row.name, row.mobile, row.source, row.status].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(q);
    });
  }

  return rows;
}

export async function updateCallbackRequestStatus(
  db: Db,
  id: string,
  status: PartnerCallbackStatus,
): Promise<PartnerCallbackRequest | null> {
  const now = new Date().toISOString();
  const result = await db.collection(COLLECTION).findOneAndUpdate(
    { id },
    { $set: { status, updatedAt: now } },
    { returnDocument: 'after', projection: { _id: 0 } },
  );
  return (result as PartnerCallbackRequest | null) || null;
}
