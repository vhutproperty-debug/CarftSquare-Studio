import { v4 as uuidv4 } from 'uuid';
import type { Db, Filter } from 'mongodb';
import { getDb } from '@/lib/mongodb';
import type { CallDisplayStatus } from '@/lib/ops/calls/statuses';
import type {
  OpsProspect,
  ProspectIntent,
  ProspectPriority,
  ProspectType,
} from '@/lib/ops/calls/types';
import { phoneKeyFromWaId, phoneLookupVariants } from '@/lib/ops/outreach-phone';

export const PROSPECTS_COLLECTION = 'ops_prospects';

const COLLECTION = PROSPECTS_COLLECTION;

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
  await db.collection(COLLECTION).createIndex({ projectName: 1, wave: 1, priority: 1 });
  await db.collection(COLLECTION).createIndex({ campaignTag: 1 });
  await db.collection(COLLECTION).createIndex({ doNotContact: 1 });
  await db.collection(COLLECTION).createIndex({ optOut: 1 });
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
  return db.collection(COLLECTION).findOne({ id }, { projection: { _id: 0 } }) as unknown as Promise<OpsProspect | null>;
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
  if (status === 'DO_NOT_CALL') {
    patch.doNotContact = true;
  } else {
    patch.doNotContact = false;
  }
  await updateProspect(db, prospectId, patch);
}

export async function findProspectsForWaId(db: Db, waId: string): Promise<OpsProspect[]> {
  await ensureProspectIndexes(db);
  const digits = String(waId || '').replace(/\D/g, '');
  if (!digits) return [];
  const phoneKey = phoneKeyFromWaId(digits);
  const variants = new Set<string>(phoneLookupVariants(phoneKey));
  variants.add(digits);
  variants.add(`+${digits}`);
  if (phoneKey) variants.add(phoneKey);

  const rows = (await db
    .collection(COLLECTION)
    .find({ phone: { $in: [...variants] } }, { projection: { _id: 0 } })
    .limit(20)
    .toArray()) as unknown as OpsProspect[];

  const international = rows.filter((row) => row.phone === phoneKey && phoneKey.startsWith('+'));
  if (international.length) return international;
  if (phoneKey && !phoneKey.startsWith('invalid:')) {
    const canonical = rows.filter((row) => row.phone === phoneKey);
    if (canonical.length) return canonical;
  }
  return rows;
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
  priority?: ProspectPriority;
  wave?: number;
  batch?: string;
  campaignTag?: string;
  intent?: ProspectIntent;
  hideOptOut?: boolean;
};

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

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
  if (filters.priority) query.priority = filters.priority;
  if (filters.wave != null) query.wave = filters.wave;
  if (filters.intent) query.intent = filters.intent;
  if (filters.batch?.trim()) {
    query.batch = { $regex: escapeRegex(filters.batch.trim()), $options: 'i' };
  }
  if (filters.campaignTag?.trim()) {
    query.campaignTag = { $regex: escapeRegex(filters.campaignTag.trim()), $options: 'i' };
  }
  if (filters.hideOptOut && !filters.callStatus) {
    query.doNotContact = { $ne: true };
    query.optOut = { $ne: true };
    query.callStatus = { $ne: 'DO_NOT_CALL' };
  }

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
    .toArray()) as unknown as OpsProspect[];

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
        prospect.salutation,
        prospect.campaignTag,
        prospect.priority,
        prospect.intent,
        prospect.batch,
        prospect.unit,
        prospect.wave != null ? String(prospect.wave) : '',
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
