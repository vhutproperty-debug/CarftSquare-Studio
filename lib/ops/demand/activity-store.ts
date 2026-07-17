import { v4 as uuidv4 } from 'uuid';
import type { Db } from 'mongodb';
import type { DemandActivityType, OpsDemandActivity } from '@/lib/ops/demand/types';
import { ensureDemandIndexes } from '@/lib/ops/demand/store';
import type { OpsLeadSource } from '@/lib/ops/leads/types';

const COLLECTION = 'ops_demand_activities';

let activityIndexesEnsured = false;

export async function ensureDemandActivityIndexes(db: Db): Promise<void> {
  if (activityIndexesEnsured) return;
  await db.collection(COLLECTION).createIndex({ id: 1 }, { unique: true });
  await db.collection(COLLECTION).createIndex({ source: 1, sourceId: 1, createdAt: -1 });
  await db.collection(COLLECTION).createIndex({ createdAt: -1 });
  await db.collection(COLLECTION).createIndex({ actorId: 1, createdAt: -1 });
  activityIndexesEnsured = true;
}

export async function createDemandActivity(
  db: Db,
  payload: {
    source: OpsLeadSource;
    sourceId: string;
    type: DemandActivityType;
    message: string;
    meta?: Record<string, unknown>;
    actorId: string;
    actorEmail?: string;
    actorName?: string;
  },
): Promise<OpsDemandActivity> {
  await ensureDemandActivityIndexes(db);
  await ensureDemandIndexes(db);
  const activity: OpsDemandActivity = {
    id: uuidv4(),
    source: payload.source,
    sourceId: payload.sourceId,
    type: payload.type,
    message: payload.message.trim(),
    meta: payload.meta,
    actorId: payload.actorId,
    actorEmail: payload.actorEmail,
    actorName: payload.actorName,
    createdAt: new Date().toISOString(),
  };
  await db.collection(COLLECTION).insertOne(activity);
  return activity;
}

export async function listDemandActivities(
  db: Db,
  source: OpsLeadSource,
  sourceId: string,
  limit = 100,
): Promise<OpsDemandActivity[]> {
  await ensureDemandActivityIndexes(db);
  return db
    .collection(COLLECTION)
    .find({ source, sourceId }, { projection: { _id: 0 } })
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray() as Promise<OpsDemandActivity[]>;
}

export async function getLatestDemandActivity(
  db: Db,
  source: OpsLeadSource,
  sourceId: string,
): Promise<OpsDemandActivity | null> {
  const items = await listDemandActivities(db, source, sourceId, 1);
  return items[0] || null;
}

/** Latest activity per (source, sourceId) in one aggregation — avoids N sequential finds. */
export async function batchLatestDemandActivities(
  db: Db,
  keys: Array<{ source: OpsLeadSource; sourceId: string }>,
): Promise<Map<string, OpsDemandActivity>> {
  await ensureDemandActivityIndexes(db);
  const map = new Map<string, OpsDemandActivity>();
  if (!keys.length) return map;

  const rows = await db
    .collection(COLLECTION)
    .aggregate([
      {
        $match: {
          $or: keys.map((k) => ({ source: k.source, sourceId: k.sourceId })),
        },
      },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: { source: '$source', sourceId: '$sourceId' },
          doc: { $first: '$$ROOT' },
        },
      },
    ])
    .toArray();

  for (const row of rows) {
    const doc = row.doc as OpsDemandActivity;
    map.set(`${doc.source}:${doc.sourceId}`, doc);
  }
  return map;
}
