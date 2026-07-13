import { v4 as uuidv4 } from 'uuid';
import type { Db } from 'mongodb';
import type { OpsSupplyActivity, SupplyActivityType } from '@/lib/ops/supply/types';
import { ensureSupplyIndexes } from '@/lib/ops/supply/store';

const COLLECTION = 'ops_supply_activities';

let activityIndexesEnsured = false;

export async function ensureSupplyActivityIndexes(db: Db): Promise<void> {
  if (activityIndexesEnsured) return;
  await ensureSupplyIndexes(db);
  await db.collection(COLLECTION).createIndex({ id: 1 }, { unique: true });
  await db.collection(COLLECTION).createIndex({ supplyId: 1, createdAt: -1 });
  await db.collection(COLLECTION).createIndex({ createdAt: -1 });
  await db.collection(COLLECTION).createIndex({ actorId: 1, createdAt: -1 });
  activityIndexesEnsured = true;
}

export async function createSupplyActivity(
  db: Db,
  payload: {
    supplyId: string;
    type: SupplyActivityType;
    message: string;
    meta?: Record<string, unknown>;
    actorId: string;
    actorEmail?: string;
    actorName?: string;
  },
): Promise<OpsSupplyActivity> {
  await ensureSupplyActivityIndexes(db);
  const activity: OpsSupplyActivity = {
    id: uuidv4(),
    supplyId: payload.supplyId,
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

export async function listSupplyActivities(
  db: Db,
  supplyId: string,
  limit = 100,
): Promise<OpsSupplyActivity[]> {
  await ensureSupplyActivityIndexes(db);
  return db
    .collection(COLLECTION)
    .find({ supplyId }, { projection: { _id: 0 } })
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray() as Promise<OpsSupplyActivity[]>;
}

export async function getLatestSupplyActivity(
  db: Db,
  supplyId: string,
): Promise<OpsSupplyActivity | null> {
  const items = await listSupplyActivities(db, supplyId, 1);
  return items[0] || null;
}

export async function batchLatestActivities(
  db: Db,
  supplyIds: string[],
): Promise<Map<string, OpsSupplyActivity>> {
  await ensureSupplyActivityIndexes(db);
  const map = new Map<string, OpsSupplyActivity>();
  if (!supplyIds.length) return map;

  const pipeline = [
    { $match: { supplyId: { $in: supplyIds } } },
    { $sort: { createdAt: -1 } },
    { $group: { _id: '$supplyId', doc: { $first: '$$ROOT' } } },
  ];

  const rows = await db.collection(COLLECTION).aggregate(pipeline).toArray();
  for (const row of rows) {
    const doc = row.doc as OpsSupplyActivity;
    map.set(doc.supplyId, doc);
  }
  return map;
}
