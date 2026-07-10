import { v4 as uuidv4 } from 'uuid';
import type { Db } from 'mongodb';
// @ts-expect-error JS module without types
import { getDb } from '@/lib/mongodb';
import type { CallActivityStatus, CallDisplayStatus } from '@/lib/ops/calls/statuses';
import type { CallTargetSummary, CallTargetType, OpsCallActivity } from '@/lib/ops/calls/types';

const COLLECTION = 'ops_call_activities';

let indexesEnsured = false;

export async function ensureCallActivityIndexes(db: Db): Promise<void> {
  if (indexesEnsured) return;
  await db.collection(COLLECTION).createIndex({ id: 1 }, { unique: true });
  await db.collection(COLLECTION).createIndex({ createdAt: -1 });
  await db.collection(COLLECTION).createIndex({ targetType: 1, targetId: 1, createdAt: -1 });
  await db.collection(COLLECTION).createIndex({ targetType: 1, targetSource: 1, targetId: 1, createdAt: -1 });
  await db.collection(COLLECTION).createIndex({ calledBy: 1, createdAt: -1 });
  await db.collection(COLLECTION).createIndex({ nextFollowUpAt: 1 });
  await db.collection(COLLECTION).createIndex({ status: 1, createdAt: -1 });
  indexesEnsured = true;
}

export function buildTargetKey(
  targetType: CallTargetType,
  targetId: string,
  targetSource?: string,
): string {
  return targetSource
    ? `${targetType}:${targetSource}:${targetId}`
    : `${targetType}:${targetId}`;
}

export async function createCallActivity(
  db: Db,
  payload: {
    targetType: CallTargetType;
    targetSource?: string;
    targetId: string;
    phone: string;
    status: CallActivityStatus;
    note?: string;
    nextFollowUpAt?: string;
    calledBy: string;
    calledByEmail?: string;
    calledByName?: string;
  },
): Promise<OpsCallActivity> {
  await ensureCallActivityIndexes(db);
  const now = new Date().toISOString();
  const activity: OpsCallActivity = {
    id: uuidv4(),
    targetType: payload.targetType,
    targetSource: payload.targetSource,
    targetId: payload.targetId,
    phone: payload.phone,
    status: payload.status,
    note: payload.note?.trim() || undefined,
    nextFollowUpAt: payload.nextFollowUpAt,
    calledBy: payload.calledBy,
    calledByEmail: payload.calledByEmail,
    calledByName: payload.calledByName,
    createdAt: now,
  };
  await db.collection(COLLECTION).insertOne(activity);
  return activity;
}

export async function listCallActivitiesForTarget(
  db: Db,
  targetType: CallTargetType,
  targetId: string,
  targetSource?: string,
  limit = 100,
): Promise<OpsCallActivity[]> {
  await ensureCallActivityIndexes(db);
  const query: Record<string, unknown> = { targetType, targetId };
  if (targetSource) query.targetSource = targetSource;

  return db
    .collection(COLLECTION)
    .find(query, { projection: { _id: 0 } })
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray() as Promise<OpsCallActivity[]>;
}

export async function getLatestCallActivityForTarget(
  db: Db,
  targetType: CallTargetType,
  targetId: string,
  targetSource?: string,
): Promise<OpsCallActivity | null> {
  const items = await listCallActivitiesForTarget(db, targetType, targetId, targetSource, 1);
  return items[0] || null;
}

export function summaryFromActivities(
  activities: OpsCallActivity[],
): CallTargetSummary {
  const latest = activities[0];
  if (!latest) {
    return {
      currentStatus: 'NOT_CALLED',
      doNotCall: false,
      wrongNumber: false,
      activityCount: 0,
    };
  }

  const wrongNumber = activities.some((item) => item.status === 'WRONG_NUMBER')
    || latest.status === 'WRONG_NUMBER';

  return {
    currentStatus: latest.status as CallDisplayStatus,
    lastCalledAt: latest.createdAt,
    lastCalledBy: latest.calledBy,
    lastCalledByName: latest.calledByName || latest.calledByEmail || null,
    nextFollowUpAt: latest.nextFollowUpAt || null,
    doNotCall: latest.status === 'DO_NOT_CALL',
    wrongNumber,
    activityCount: activities.length,
  };
}

export async function getCallTargetSummary(
  db: Db,
  targetType: CallTargetType,
  targetId: string,
  targetSource?: string,
): Promise<CallTargetSummary> {
  const activities = await listCallActivitiesForTarget(db, targetType, targetId, targetSource, 100);
  return summaryFromActivities(activities);
}

type TargetRef = {
  targetType: CallTargetType;
  targetId: string;
  targetSource?: string;
};

export async function batchGetLatestActivities(
  db: Db,
  targets: TargetRef[],
): Promise<Map<string, OpsCallActivity>> {
  await ensureCallActivityIndexes(db);
  const map = new Map<string, OpsCallActivity>();
  if (!targets.length) return map;

  await Promise.all(
    targets.map(async (target) => {
      const latest = await getLatestCallActivityForTarget(
        db,
        target.targetType,
        target.targetId,
        target.targetSource,
      );
      if (latest) {
        map.set(
          buildTargetKey(target.targetType, target.targetId, target.targetSource),
          latest,
        );
      }
    }),
  );

  return map;
}

export async function countActivitiesLoggedToday(
  db: Db,
  calledBy?: string,
): Promise<number> {
  await ensureCallActivityIndexes(db);
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const query: Record<string, unknown> = {
    createdAt: { $gte: start.toISOString() },
  };
  if (calledBy) query.calledBy = calledBy;
  return db.collection(COLLECTION).countDocuments(query);
}

export async function getDatabase(): Promise<Db> {
  return getDb();
}
