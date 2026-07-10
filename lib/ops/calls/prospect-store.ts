import { v4 as uuidv4 } from 'uuid';
import type { Db, Filter } from 'mongodb';
// @ts-expect-error JS module without types
import { getDb } from '@/lib/mongodb';
import type { CallDisplayStatus } from '@/lib/ops/calls/statuses';
import type { OpsProspect, ProspectType } from '@/lib/ops/calls/types';

const COLLECTION = 'ops_prospects';

let indexesEnsured = false;

export async function ensureProspectIndexes(db: Db): Promise<void> {
  if (indexesEnsured) return;
  await db.collection(COLLECTION).createIndex({ id: 1 }, { unique: true });
  await db.collection(COLLECTION).createIndex({ createdAt: -1 });
  await db.collection(COLLECTION).createIndex({ phone: 1 });
  await db.collection(COLLECTION).createIndex({ assignedTo: 1, callStatus: 1 });
  await db.collection(COLLECTION).createIndex({ callStatus: 1, nextFollowUpAt: 1 });
  await db.collection(COLLECTION).createIndex({ projectName: 1 });
  await db.collection(COLLECTION).createIndex({ building: 1 });
  await db.collection(COLLECTION).createIndex({ prospectType: 1 });
  indexesEnsured = true;
}

export async function createProspect(
  db: Db,
  payload: Omit<OpsProspect, 'id' | 'callStatus' | 'createdAt' | 'updatedAt' | 'phoneInvalid'> & {
    callStatus?: CallDisplayStatus;
  },
): Promise<OpsProspect> {
  await ensureProspectIndexes(db);
  const now = new Date().toISOString();
  const prospect: OpsProspect = {
    ...payload,
    id: uuidv4(),
    callStatus: payload.callStatus || 'NOT_CALLED',
    phoneInvalid: false,
    createdAt: now,
    updatedAt: now,
  };
  await db.collection(COLLECTION).insertOne(prospect);
  return prospect;
}

export async function getProspectById(db: Db, id: string): Promise<OpsProspect | null> {
  await ensureProspectIndexes(db);
  return db.collection(COLLECTION).findOne({ id }, { projection: { _id: 0 } }) as Promise<OpsProspect | null>;
}

export async function updateProspect(
  db: Db,
  id: string,
  patch: Partial<Omit<OpsProspect, 'id' | 'createdBy' | 'createdAt'>>,
): Promise<OpsProspect | null> {
  await ensureProspectIndexes(db);
  const updatedAt = new Date().toISOString();
  const result = await db.collection(COLLECTION).updateOne(
    { id },
    { $set: { ...patch, updatedAt } },
  );
  if (!result.matchedCount) return null;
  return getProspectById(db, id);
}

export async function syncProspectFromCallActivity(
  db: Db,
  prospectId: string,
  status: CallDisplayStatus,
  nextFollowUpAt?: string,
): Promise<void> {
  const patch: Partial<OpsProspect> = {
    callStatus: status,
    nextFollowUpAt: nextFollowUpAt || undefined,
  };
  if (status === 'WRONG_NUMBER') {
    patch.phoneInvalid = true;
  }
  await updateProspect(db, prospectId, patch);
}

export type ProspectListFilters = {
  assignedTo?: string;
  mineOnly?: boolean;
  currentAdminId?: string;
  isAdminViewAll?: boolean;
  project?: string;
  prospectType?: ProspectType;
  callStatus?: CallDisplayStatus;
  search?: string;
  limit?: number;
};

export async function listProspects(
  db: Db,
  filters: ProspectListFilters = {},
): Promise<OpsProspect[]> {
  await ensureProspectIndexes(db);
  const query: Filter<OpsProspect> = {};

  if (filters.mineOnly && filters.currentAdminId) {
    query.assignedTo = filters.currentAdminId;
  } else if (filters.assignedTo) {
    query.assignedTo = filters.assignedTo;
  } else if (!filters.isAdminViewAll && filters.currentAdminId) {
    query.$or = [
      { assignedTo: filters.currentAdminId },
      { assignedTo: { $exists: false } },
      { assignedTo: '' },
    ];
  }

  if (filters.prospectType) query.prospectType = filters.prospectType;
  if (filters.callStatus) query.callStatus = filters.callStatus;

  if (filters.project?.trim()) {
    const projectRegex = new RegExp(filters.project.trim(), 'i');
    query.$and = [
      ...(Array.isArray(query.$and) ? query.$and : []),
      {
        $or: [
          { projectName: projectRegex },
          { building: projectRegex },
        ],
      },
    ];
  }

  let prospects = (await db
    .collection(COLLECTION)
    .find(query, { projection: { _id: 0 } })
    .sort({ updatedAt: -1 })
    .limit(filters.limit || 1000)
    .toArray()) as OpsProspect[];

  const search = filters.search?.trim().toLowerCase();
  if (search) {
    prospects = prospects.filter((prospect) => {
      const haystack = [
        prospect.name,
        prospect.phone,
        prospect.alternatePhone,
        prospect.email,
        prospect.projectName,
        prospect.building,
        prospect.location,
        prospect.requirement,
        prospect.notes,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(search);
    });
  }

  return prospects;
}

export async function getDatabase(): Promise<Db> {
  return getDb();
}
