import { v4 as uuidv4 } from 'uuid';
import type { Db, Filter } from 'mongodb';
// @ts-expect-error JS module without types
import { getDb } from '@/lib/mongodb';
import type { OpsRenewalRecord } from '@/lib/ops/renewals/types';
import type { RenewalStatus } from '@/lib/ops/renewals/statuses';

const COLLECTION = 'ops_renewal_records';

let indexesEnsured = false;

export async function ensureRenewalIndexes(db: Db): Promise<void> {
  if (indexesEnsured) return;
  await db.collection(COLLECTION).createIndex({ id: 1 }, { unique: true });
  await db.collection(COLLECTION).createIndex({ agreementId: 1 }, { unique: true });
  await db.collection(COLLECTION).createIndex({ dealId: 1 });
  await db.collection(COLLECTION).createIndex({ status: 1, dueDate: 1 });
  await db.collection(COLLECTION).createIndex({ dueDate: 1 });
  indexesEnsured = true;
}

export async function getRenewalByAgreementId(db: Db, agreementId: string): Promise<OpsRenewalRecord | null> {
  await ensureRenewalIndexes(db);
  return db.collection(COLLECTION).findOne({ agreementId }, { projection: { _id: 0 } }) as Promise<OpsRenewalRecord | null>;
}

export async function createRenewalRecord(db: Db, record: Omit<OpsRenewalRecord, 'id' | 'createdAt' | 'updatedAt'>): Promise<OpsRenewalRecord> {
  await ensureRenewalIndexes(db);
  const now = new Date().toISOString();
  const doc: OpsRenewalRecord = { ...record, id: uuidv4(), createdAt: now, updatedAt: now };
  await db.collection(COLLECTION).insertOne(doc);
  return doc;
}

export async function listRenewalRecords(db: Db, filter: Filter<OpsRenewalRecord> = {}, limit = 5000): Promise<OpsRenewalRecord[]> {
  await ensureRenewalIndexes(db);
  return db.collection(COLLECTION).find(filter, { projection: { _id: 0 } }).limit(limit).toArray() as Promise<OpsRenewalRecord[]>;
}

export async function getRenewalRecord(db: Db, id: string): Promise<OpsRenewalRecord | null> {
  await ensureRenewalIndexes(db);
  return db.collection(COLLECTION).findOne({ id }, { projection: { _id: 0 } }) as Promise<OpsRenewalRecord | null>;
}

export async function updateRenewalRecord(
  db: Db,
  id: string,
  patch: Partial<{ status: RenewalStatus; renewedAt: string | null; notes: string; updatedBy: string }>,
): Promise<OpsRenewalRecord | null> {
  await ensureRenewalIndexes(db);
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
  return result as OpsRenewalRecord | null;
}

export { getDb as getDatabase };
