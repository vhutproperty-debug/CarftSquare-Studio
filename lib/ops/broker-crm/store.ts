import type { Db } from 'mongodb';
import { getDb } from '@/lib/mongodb';
import { randomUUID } from 'node:crypto';
import { BrokerCrmValidationError } from '@/lib/ops/broker-crm/errors';
import { mumbaiToday } from '@/lib/ops/broker-crm/format';
import { brokerPriorityScore } from '@/lib/ops/broker-crm/priority';
import { applyBrokerCrmPatch, type BrokerCrmPatch } from '@/lib/ops/broker-crm/patch';
import { planBrokerCrmImport } from '@/lib/ops/broker-crm/plan';
import { isDoNotContact } from '@/lib/ops/broker-crm/privacy';
import { applyBrokerCrmQuery } from '@/lib/ops/broker-crm/query';
import {
  buildWaveApproval,
  buildWaveMessageTemplate,
  buildWhatsAppPriorityQueue,
  type WaveApproval,
  type WaveId,
  type WaveTemplateInput,
} from '@/lib/ops/broker-crm/waves';
import {
  BROKER_CRM_COLLECTION,
  BROKER_CRM_WAVE_APPROVAL_COLLECTION,
  type BrokerCrmImportStats,
  type BrokerCrmListQuery,
  type BrokerCrmListResult,
  type BrokerCrmStatus,
  type BrokerImportRow,
  type OpsBrokerCrmRecord,
  isBrokerCrmStatus,
} from '@/lib/ops/broker-crm/types';

const ensured = new WeakSet<object>();

function asRecord(doc: Record<string, unknown>): OpsBrokerCrmRecord {
  const status: BrokerCrmStatus = isBrokerCrmStatus(String(doc.status || ''))
    ? doc.status as BrokerCrmStatus
    : 'new';
  const groups = Array.isArray(doc.groups) ? doc.groups.map((group) => String(group)) : [];
  const admin = Boolean(doc.admin);
  const doNotContact = status === 'do-not-contact' || doc.doNotContact === true;
  const resolvedStatus: BrokerCrmStatus = doNotContact ? 'do-not-contact' : status;
  return {
    id: String(doc.id || ''),
    phone: String(doc.phone || ''),
    name: String(doc.name || 'Unnamed broker'),
    nameEdited: Boolean(doc.nameEdited),
    groups,
    groupCount: groups.length,
    admin,
    derivedAreas: Array.isArray(doc.derivedAreas) ? doc.derivedAreas.map(String) : [],
    derivedProjects: Array.isArray(doc.derivedProjects) ? doc.derivedProjects.map(String) : [],
    areaTags: Array.isArray(doc.areaTags) ? doc.areaTags.map(String) : [],
    projectTags: Array.isArray(doc.projectTags) ? doc.projectTags.map(String) : [],
    status: resolvedStatus,
    notes: typeof doc.notes === 'string' ? doc.notes : '',
    lastContactedAt: typeof doc.lastContactedAt === 'string' ? doc.lastContactedAt : null,
    requirements: Array.isArray(doc.requirements) ? doc.requirements as OpsBrokerCrmRecord['requirements'] : [],
    priorityScore: brokerPriorityScore(groups.length, admin),
    doNotContact,
    doNotContactAt: typeof doc.doNotContactAt === 'string' ? doc.doNotContactAt : null,
    doNotContactReason: typeof doc.doNotContactReason === 'string' ? doc.doNotContactReason : null,
    source: 'whatsapp_groups',
    createdAt: String(doc.createdAt || ''),
    updatedAt: String(doc.updatedAt || ''),
    importedAt: typeof doc.importedAt === 'string' ? doc.importedAt : null,
  };
}

export async function ensureBrokerCrmIndexes(db: Db): Promise<void> {
  if (ensured.has(db)) return;
  const col = db.collection(BROKER_CRM_COLLECTION);
  await col.createIndex({ id: 1 }, { unique: true });
  await col.createIndex({ phone: 1 }, { unique: true });
  await col.createIndex({ priorityScore: -1, name: 1 });
  await col.createIndex({ status: 1 });
  await db.collection(BROKER_CRM_WAVE_APPROVAL_COLLECTION).createIndex({ id: 1 }, { unique: true });
  await db.collection(BROKER_CRM_WAVE_APPROVAL_COLLECTION).createIndex({ wave: 1, approvedAt: -1 });
  ensured.add(db);
}

async function loadAll(db: Db): Promise<OpsBrokerCrmRecord[]> {
  await ensureBrokerCrmIndexes(db);
  const docs = await db.collection(BROKER_CRM_COLLECTION).find({}).toArray();
  return docs.map((doc) => asRecord(doc as Record<string, unknown>));
}

export async function listBrokerCrm(db: Db, query: BrokerCrmListQuery): Promise<BrokerCrmListResult> {
  return applyBrokerCrmQuery(await loadAll(db), query);
}

export async function getBrokerCrm(db: Db, id: string): Promise<OpsBrokerCrmRecord | null> {
  await ensureBrokerCrmIndexes(db);
  const doc = await db.collection(BROKER_CRM_COLLECTION).findOne({ id });
  return doc ? asRecord(doc as Record<string, unknown>) : null;
}

export async function listBrokerCrmForMarket(db: Db): Promise<OpsBrokerCrmRecord[]> {
  const records = await loadAll(db);
  return records.filter((record) => !isDoNotContact(record) && record.status !== 'dormant');
}

export async function importBrokerCrmRows(
  db: Db,
  rows: BrokerImportRow[],
  now = new Date().toISOString(),
): Promise<BrokerCrmImportStats> {
  await ensureBrokerCrmIndexes(db);
  const existing = await loadAll(db);
  const plan = planBrokerCrmImport(existing, rows, now);
  const col = db.collection(BROKER_CRM_COLLECTION);
  if (plan.writes.length && typeof col.bulkWrite === 'function') {
    await col.bulkWrite(plan.writes.map((record) => ({
      updateOne: {
        filter: { phone: record.phone },
        update: { $set: record },
        upsert: true,
      },
    })), { ordered: false });
  } else {
    for (const record of plan.writes) {
      await col.updateOne({ phone: record.phone }, { $set: record }, { upsert: true });
    }
  }
  return plan.stats;
}

export async function updateBrokerCrm(
  db: Db,
  id: string,
  patch: BrokerCrmPatch,
  now = new Date().toISOString(),
): Promise<OpsBrokerCrmRecord | null> {
  const current = await getBrokerCrm(db, id);
  if (!current) return null;
  const next = applyBrokerCrmPatch(current, patch, now);
  await db.collection(BROKER_CRM_COLLECTION).updateOne({ id }, { $set: next });
  return next;
}

export async function loadBrokerCrmRecords(db: Db): Promise<OpsBrokerCrmRecord[]> {
  return loadAll(db);
}

export async function queueBrokerCrm(db: Db) {
  const records = await loadAll(db);
  const queue = buildWhatsAppPriorityQueue(records);
  const approvals = await listWaveApprovals(db);
  return { ...queue, approvals };
}

export async function markBrokerContacted(
  db: Db,
  id: string,
  now = new Date().toISOString(),
): Promise<OpsBrokerCrmRecord | null> {
  const current = await getBrokerCrm(db, id);
  if (!current) return null;
  if (isDoNotContact(current)) {
    throw new BrokerCrmValidationError('Do-not-contact brokers stay out of the priority queue.');
  }
  const status = current.status === 'active' ? 'active' : 'contacted';
  return updateBrokerCrm(db, id, { status, lastContactedAt: mumbaiToday(new Date(now)) }, now);
}

function asApproval(doc: Record<string, unknown>): WaveApproval {
  const wave = Number(doc.wave);
  return buildWaveApproval({
    id: String(doc.id || ''),
    wave: wave === 2 || wave === 3 ? wave : 1,
    approvedAt: String(doc.approvedAt || ''),
    approvedById: String(doc.approvedById || ''),
    approvedByEmail: String(doc.approvedByEmail || ''),
    recipientCount: Number(doc.recipientCount || 0),
    template: typeof doc.template === 'string' ? doc.template : null,
  });
}

export async function listWaveApprovals(db: Db): Promise<WaveApproval[]> {
  await ensureBrokerCrmIndexes(db);
  const docs = await db.collection(BROKER_CRM_WAVE_APPROVAL_COLLECTION).find({}).toArray();
  return docs
    .map((doc) => asApproval(doc as Record<string, unknown>))
    .sort((a, b) => b.approvedAt.localeCompare(a.approvedAt));
}

export async function approveBrokerCrmWave(
  db: Db,
  input: {
    wave: WaveId;
    approvedById: string;
    approvedByEmail: string;
    template?: WaveTemplateInput | null;
    now?: string;
  },
): Promise<{ approval: WaveApproval; recipientCount: number }> {
  const records = await loadAll(db);
  const queue = buildWhatsAppPriorityQueue(records);
  const template = input.template ? buildWaveMessageTemplate(input.template) : null;
  const approval = buildWaveApproval({
    id: randomUUID(),
    wave: input.wave,
    approvedAt: input.now || new Date().toISOString(),
    approvedById: input.approvedById,
    approvedByEmail: input.approvedByEmail,
    recipientCount: queue.counts[input.wave],
    template: template?.text || null,
  });
  await db.collection(BROKER_CRM_WAVE_APPROVAL_COLLECTION).insertOne({ ...approval });
  return { approval, recipientCount: approval.recipientCount };
}

export async function getBrokerCrmDatabase(): Promise<Db> {
  return getDb();
}
