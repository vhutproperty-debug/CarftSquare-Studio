import { v4 as uuidv4 } from 'uuid';
import type { Db, Filter } from 'mongodb';
// @ts-expect-error JS module without types
import { getDb } from '@/lib/mongodb';
import { createDealActivity } from '@/lib/ops/deals/activity-store';
import type { DealDocumentsChecklist, OpsDealRecord } from '@/lib/ops/deals/types';
import { defaultDocumentsChecklist } from '@/lib/ops/deals/types';
import type { DealPaymentStatus, DealStage, DealTransactionType } from '@/lib/ops/deals/statuses';
import { STAGE_PROBABILITY } from '@/lib/ops/deals/statuses';

const COLLECTION = 'ops_deals';

let indexesEnsured = false;

export async function ensureDealIndexes(db: Db): Promise<void> {
  if (indexesEnsured) return;
  await db.collection(COLLECTION).createIndex({ id: 1 }, { unique: true });
  await db.collection(COLLECTION).createIndex({ dealNumber: 1 }, { unique: true });
  await db.collection(COLLECTION).createIndex({ matchId: 1 }, { unique: true });
  await db.collection(COLLECTION).createIndex({ stage: 1, updatedAt: -1 });
  await db.collection(COLLECTION).createIndex({ broker: 1, stage: 1 });
  await db.collection(COLLECTION).createIndex({ project: 1 });
  await db.collection(COLLECTION).createIndex({ demandKey: 1 });
  await db.collection(COLLECTION).createIndex({ supplyId: 1 });
  await db.collection(COLLECTION).createIndex({ createdAt: -1 });
  await db.collection(COLLECTION).createIndex({ updatedAt: -1 });
  indexesEnsured = true;
}

export async function nextDealNumber(db: Db): Promise<string> {
  await ensureDealIndexes(db);
  const year = new Date().getFullYear();
  const prefix = `CS-D-${year}-`;
  const count = await db.collection(COLLECTION).countDocuments({
    dealNumber: { $regex: `^${prefix}` },
  });
  return `${prefix}${String(count + 1).padStart(4, '0')}`;
}

export async function getDealByMatchId(db: Db, matchId: string): Promise<OpsDealRecord | null> {
  await ensureDealIndexes(db);
  return db.collection(COLLECTION).findOne({ matchId }, { projection: { _id: 0 } }) as Promise<OpsDealRecord | null>;
}

export async function createDealRecord(
  db: Db,
  payload: Omit<OpsDealRecord, 'id' | 'dealNumber' | 'createdAt' | 'updatedAt'> & {
    dealNumber?: string;
    actorEmail?: string;
    actorName?: string;
  },
): Promise<OpsDealRecord> {
  await ensureDealIndexes(db);
  const now = new Date().toISOString();
  const dealNumber = payload.dealNumber || await nextDealNumber(db);
  const { actorEmail, actorName, ...recordPayload } = payload;
  const record: OpsDealRecord = {
    ...recordPayload,
    id: uuidv4(),
    dealNumber,
    documentsChecklist: recordPayload.documentsChecklist || defaultDocumentsChecklist(),
    probability: recordPayload.probability ?? STAGE_PROBABILITY[recordPayload.stage],
    paymentStatus: recordPayload.paymentStatus || 'NOT_DUE',
    createdAt: now,
    updatedAt: now,
  };
  await db.collection(COLLECTION).insertOne(record);
  await createDealActivity(db, {
    dealId: record.id,
    type: 'DEAL_CREATED',
    message: `Deal ${dealNumber} created from accepted match`,
    actorId: recordPayload.createdBy,
    actorEmail,
    actorName,
  });
  return record;
}

export async function getDealRecord(db: Db, id: string): Promise<OpsDealRecord | null> {
  await ensureDealIndexes(db);
  return db.collection(COLLECTION).findOne({ id }, { projection: { _id: 0 } }) as Promise<OpsDealRecord | null>;
}

export async function listDealRecords(
  db: Db,
  filter: Filter<OpsDealRecord> = {},
  limit = 5000,
): Promise<OpsDealRecord[]> {
  await ensureDealIndexes(db);
  return db.collection(COLLECTION).find(filter, { projection: { _id: 0 } }).limit(limit).toArray() as Promise<OpsDealRecord[]>;
}

export async function updateDealRecord(
  db: Db,
  id: string,
  patch: Partial<{
    broker: string | null;
    brokerName: string | null;
    clientName: string;
    ownerName: string;
    project: string;
    building: string;
    flat: string;
    transactionType: DealTransactionType;
    expectedRent: string;
    expectedSaleValue: string;
    expectedBrokerage: string;
    interiorOpportunity: boolean;
    stage: DealStage;
    probability: number;
    targetClosingDate: string | null;
    siteVisitDate: string | null;
    offerAmount: string;
    negotiationNotes: string;
    documentsChecklist: DealDocumentsChecklist;
    agreementDate: string | null;
    agreementValue: string;
    actualBrokerage: string;
    paymentStatus: DealPaymentStatus;
    commissionCollected: string;
    lostReason: string;
    internalNotes: string;
    updatedBy: string;
  }>,
): Promise<OpsDealRecord | null> {
  await ensureDealIndexes(db);
  const updatedAt = new Date().toISOString();
  const setDoc: Record<string, unknown> = { updatedAt };
  const unsetDoc: Record<string, string> = {};

  for (const [key, value] of Object.entries(patch)) {
    if (value === null) unsetDoc[key] = '';
    else if (value !== undefined) setDoc[key] = value;
  }

  const update: Record<string, unknown> = { $set: setDoc };
  if (Object.keys(unsetDoc).length) update.$unset = unsetDoc;

  const result = await db.collection(COLLECTION).findOneAndUpdate(
    { id },
    update,
    { returnDocument: 'after', projection: { _id: 0 } },
  );

  return result as OpsDealRecord | null;
}

export { getDb as getDatabase };
