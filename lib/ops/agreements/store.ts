import { v4 as uuidv4 } from 'uuid';
import type { Db, Filter } from 'mongodb';
// @ts-expect-error JS module without types
import { getDb } from '@/lib/mongodb';
import type { OpsAgreementRecord } from '@/lib/ops/agreements/types';
import type { AgreementStatus, AgreementType } from '@/lib/ops/agreements/statuses';

const COLLECTION = 'ops_agreement_records';

let indexesEnsured = false;

export async function ensureAgreementIndexes(db: Db): Promise<void> {
  if (indexesEnsured) return;
  await db.collection(COLLECTION).createIndex({ id: 1 }, { unique: true });
  await db.collection(COLLECTION).createIndex({ dealId: 1 }, { unique: true });
  await db.collection(COLLECTION).createIndex({ status: 1, expiryDate: 1 });
  await db.collection(COLLECTION).createIndex({ broker: 1 });
  await db.collection(COLLECTION).createIndex({ expiryDate: 1 });
  await db.collection(COLLECTION).createIndex({ updatedAt: -1 });
  indexesEnsured = true;
}

export async function getAgreementByDealId(db: Db, dealId: string): Promise<OpsAgreementRecord | null> {
  await ensureAgreementIndexes(db);
  return db.collection(COLLECTION).findOne({ dealId }, { projection: { _id: 0 } }) as Promise<OpsAgreementRecord | null>;
}

export async function createAgreementRecord(db: Db, record: Omit<OpsAgreementRecord, 'id' | 'createdAt' | 'updatedAt'>): Promise<OpsAgreementRecord> {
  await ensureAgreementIndexes(db);
  const now = new Date().toISOString();
  const doc: OpsAgreementRecord = { ...record, id: uuidv4(), createdAt: now, updatedAt: now };
  await db.collection(COLLECTION).insertOne(doc);
  return doc;
}

export async function getAgreementRecord(db: Db, id: string): Promise<OpsAgreementRecord | null> {
  await ensureAgreementIndexes(db);
  return db.collection(COLLECTION).findOne({ id }, { projection: { _id: 0 } }) as Promise<OpsAgreementRecord | null>;
}

export async function listAgreementRecords(db: Db, filter: Filter<OpsAgreementRecord> = {}, limit = 5000): Promise<OpsAgreementRecord[]> {
  await ensureAgreementIndexes(db);
  return db.collection(COLLECTION).find(filter, { projection: { _id: 0 } }).limit(limit).toArray() as Promise<OpsAgreementRecord[]>;
}

export async function updateAgreementRecord(
  db: Db,
  id: string,
  patch: Partial<{
    status: AgreementStatus;
    agreementType: AgreementType;
    scheduledDate: string | null;
    signedDate: string | null;
    expiryDate: string | null;
    agreementValue: string;
    documentsComplete: boolean;
    renewalDueDate: string | null;
    notes: string;
    updatedBy: string;
  }>,
): Promise<OpsAgreementRecord | null> {
  await ensureAgreementIndexes(db);
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
  return result as OpsAgreementRecord | null;
}

export { getDb as getDatabase };
