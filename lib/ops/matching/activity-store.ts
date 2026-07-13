import { v4 as uuidv4 } from 'uuid';
import type { Db } from 'mongodb';
import type { MatchActivityType, OpsMatchActivity } from '@/lib/ops/matching/types';
import { ensureMatchIndexes } from '@/lib/ops/matching/store';

const COLLECTION = 'ops_match_activities';

let activityIndexesEnsured = false;

export async function ensureMatchActivityIndexes(db: Db): Promise<void> {
  if (activityIndexesEnsured) return;
  await ensureMatchIndexes(db);
  await db.collection(COLLECTION).createIndex({ id: 1 }, { unique: true });
  await db.collection(COLLECTION).createIndex({ matchId: 1, createdAt: -1 });
  await db.collection(COLLECTION).createIndex({ createdAt: -1 });
  activityIndexesEnsured = true;
}

export async function createMatchActivity(
  db: Db,
  payload: {
    matchId: string;
    type: MatchActivityType;
    message: string;
    meta?: Record<string, unknown>;
    actorId: string;
    actorEmail?: string;
    actorName?: string;
  },
): Promise<OpsMatchActivity> {
  await ensureMatchActivityIndexes(db);
  const activity: OpsMatchActivity = {
    id: uuidv4(),
    matchId: payload.matchId,
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

export async function listMatchActivities(db: Db, matchId: string, limit = 100): Promise<OpsMatchActivity[]> {
  await ensureMatchActivityIndexes(db);
  return db
    .collection(COLLECTION)
    .find({ matchId }, { projection: { _id: 0 } })
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray() as Promise<OpsMatchActivity[]>;
}

export async function batchLatestMatchActivities(
  db: Db,
  matchIds: string[],
): Promise<Map<string, OpsMatchActivity>> {
  await ensureMatchActivityIndexes(db);
  const map = new Map<string, OpsMatchActivity>();
  if (!matchIds.length) return map;

  const rows = await db.collection(COLLECTION).aggregate([
    { $match: { matchId: { $in: matchIds } } },
    { $sort: { createdAt: -1 } },
    { $group: { _id: '$matchId', doc: { $first: '$$ROOT' } } },
  ]).toArray();

  for (const row of rows) {
    const doc = row.doc as OpsMatchActivity;
    map.set(doc.matchId, doc);
  }
  return map;
}
