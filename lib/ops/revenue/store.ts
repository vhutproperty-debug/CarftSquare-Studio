import { v4 as uuidv4 } from 'uuid';
import type { Db, Filter } from 'mongodb';
// @ts-expect-error JS module without types
import { getDb } from '@/lib/mongodb';
import type { OpsRevenueRecord } from '@/lib/ops/revenue/types';
import type { RevenueStatus, RevenueStreamType } from '@/lib/ops/revenue/statuses';

const COLLECTION = 'ops_revenue_records';

let indexesEnsured = false;

export async function ensureRevenueIndexes(db: Db): Promise<void> {
  if (indexesEnsured) return;
  await db.collection(COLLECTION).createIndex({ id: 1 }, { unique: true });
  await db.collection(COLLECTION).createIndex({ dealId: 1 }, { unique: true });
  await db.collection(COLLECTION).createIndex({ status: 1, dueDate: 1 });
  await db.collection(COLLECTION).createIndex({ broker: 1, status: 1 });
  await db.collection(COLLECTION).createIndex({ updatedAt: -1 });
  indexesEnsured = true;
}

export async function getRevenueByDealId(db: Db, dealId: string): Promise<OpsRevenueRecord | null> {
  await ensureRevenueIndexes(db);
  return db.collection(COLLECTION).findOne({ dealId }, { projection: { _id: 0 } }) as Promise<OpsRevenueRecord | null>;
}

export async function createRevenueRecord(db: Db, record: Omit<OpsRevenueRecord, 'id' | 'createdAt' | 'updatedAt'>): Promise<OpsRevenueRecord> {
  await ensureRevenueIndexes(db);
  const now = new Date().toISOString();
  const doc: OpsRevenueRecord = { ...record, id: uuidv4(), createdAt: now, updatedAt: now };
  await db.collection(COLLECTION).insertOne(doc);
  return doc;
}

export async function getRevenueRecord(db: Db, id: string): Promise<OpsRevenueRecord | null> {
  await ensureRevenueIndexes(db);
  return db.collection(COLLECTION).findOne({ id }, { projection: { _id: 0 } }) as Promise<OpsRevenueRecord | null>;
}

export async function listRevenueRecords(db: Db, filter: Filter<OpsRevenueRecord> = {}, limit = 5000): Promise<OpsRevenueRecord[]> {
  await ensureRevenueIndexes(db);
  return db.collection(COLLECTION).find(filter, { projection: { _id: 0 } }).limit(limit).toArray() as Promise<OpsRevenueRecord[]>;
}

export async function updateRevenueRecord(
  db: Db,
  id: string,
  patch: Partial<{
    expectedAmount: number;
    invoicedAmount: number;
    collectedAmount: number;
    pendingAmount: number;
    status: RevenueStatus;
    dueDate: string | null;
    collectedAt: string | null;
    interiorReferral: boolean;
    notes: string;
    updatedBy: string;
  }>,
): Promise<OpsRevenueRecord | null> {
  await ensureRevenueIndexes(db);
  const updatedAt = new Date().toISOString();
  const setDoc: Record<string, unknown> = { updatedAt };
  const unsetDoc: Record<string, string> = {};
  for (const [key, value] of Object.entries(patch)) {
    if (value === null) unsetDoc[key] = '';
    else if (value !== undefined) setDoc[key] = value;
  }
  const update: Record<string, unknown> = { $set: setDoc };
  if (Object.keys(unsetDoc).length) update.$unset = unsetDoc;
  const result = await db.collection(COLLECTION).findOneAndUpdate({ id }, update, { returnDocument: 'after', projection: { _id: 0 } });
  return result as OpsRevenueRecord | null;
}

export { getDb as getDatabase };
