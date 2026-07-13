import { v4 as uuidv4 } from 'uuid';
import type { Db } from 'mongodb';
import type { DealActivityType, OpsDealActivity } from '@/lib/ops/deals/types';
import { ensureDealIndexes } from '@/lib/ops/deals/store';

const COLLECTION = 'ops_deal_activities';

let activityIndexesEnsured = false;

export async function ensureDealActivityIndexes(db: Db): Promise<void> {
  if (activityIndexesEnsured) return;
  await ensureDealIndexes(db);
  await db.collection(COLLECTION).createIndex({ id: 1 }, { unique: true });
  await db.collection(COLLECTION).createIndex({ dealId: 1, createdAt: -1 });
  await db.collection(COLLECTION).createIndex({ createdAt: -1 });
  activityIndexesEnsured = true;
}

export async function createDealActivity(
  db: Db,
  payload: {
    dealId: string;
    type: DealActivityType;
    message: string;
    meta?: Record<string, unknown>;
    actorId: string;
    actorEmail?: string;
    actorName?: string;
  },
): Promise<OpsDealActivity> {
  await ensureDealActivityIndexes(db);
  const activity: OpsDealActivity = {
    id: uuidv4(),
    dealId: payload.dealId,
    type: payload.type,
    message: payload.message,
    meta: payload.meta,
    actorId: payload.actorId,
    actorEmail: payload.actorEmail,
    actorName: payload.actorName,
    createdAt: new Date().toISOString(),
  };
  await db.collection(COLLECTION).insertOne(activity);
  return activity;
}

export async function listDealActivities(db: Db, dealId: string, limit = 100): Promise<OpsDealActivity[]> {
  await ensureDealActivityIndexes(db);
  return db
    .collection(COLLECTION)
    .find({ dealId }, { projection: { _id: 0 } })
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray() as Promise<OpsDealActivity[]>;
}

export async function batchLatestDealActivities(
  db: Db,
  dealIds: string[],
): Promise<Map<string, OpsDealActivity>> {
  await ensureDealActivityIndexes(db);
  const map = new Map<string, OpsDealActivity>();
  if (!dealIds.length) return map;

  const rows = await db.collection(COLLECTION).aggregate([
    { $match: { dealId: { $in: dealIds } } },
    { $sort: { createdAt: -1 } },
    { $group: { _id: '$dealId', doc: { $first: '$$ROOT' } } },
  ]).toArray();

  for (const row of rows) {
    const doc = row.doc as OpsDealActivity;
    map.set(doc.dealId, doc);
  }
  return map;
}
