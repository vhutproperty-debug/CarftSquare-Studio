import { v4 as uuidv4 } from 'uuid';
import type { Db } from 'mongodb';
// @ts-expect-error JS module without types
import { getDb } from '@/lib/mongodb';
import { enqueueFollowUpJob } from '@/lib/ops/followups/store';
import { assertOsWhatsAppSendAllowed } from '@/lib/ops/channels/safety';
import { appendOpsAudit } from '@/lib/ops/os/audit';
import { stampCreate, stampUpdate } from '@/lib/ops/os/records';

export const GROWTH_TEMPLATES_COLLECTION = 'ops_growth_wa_templates';
export const GROWTH_FOLLOWUPS_COLLECTION = 'ops_growth_followup_batches';

export type GrowthTemplate = {
  id: string;
  name: string;
  language: string;
  status: string;
  metaId: string;
  updatedAt: string;
};

export type DeliveryStatus = 'queued' | 'sent' | 'delivered' | 'read' | 'replied' | 'failed';

export type FollowUpRecipient = { phone: string; leadId: string };

export type FollowUpBatch = {
  id: string;
  templateName: string;
  languageCode: string;
  recipients: FollowUpRecipient[];
  scheduledFor: string;
  status: 'pending_approval' | 'approved' | 'blocked' | 'queued';
  bulk: boolean;
  approvedBy: string;
  approvedAt: string | null;
  deliveries: Array<{ phone: string; status: DeliveryStatus; detail: string }>;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

let indexesReady = false;

async function ensureIndexes(db: Db): Promise<void> {
  if (indexesReady) return;
  await db.collection(GROWTH_TEMPLATES_COLLECTION).createIndex({ id: 1 }, { unique: true });
  await db.collection(GROWTH_TEMPLATES_COLLECTION).createIndex({ name: 1, language: 1 }, { unique: true });
  await db.collection(GROWTH_FOLLOWUPS_COLLECTION).createIndex({ id: 1 }, { unique: true });
  indexesReady = true;
}

export async function listGrowthTemplates(db: Db): Promise<GrowthTemplate[]> {
  await ensureIndexes(db);
  const rows = await db.collection(GROWTH_TEMPLATES_COLLECTION).find({}).toArray();
  return rows as unknown as GrowthTemplate[];
}

export async function syncApprovedTemplates(
  db: Db,
  remote: Array<{ name?: string; language?: string; status?: string; id?: string }>,
): Promise<{ templates: GrowthTemplate[]; approved: number }> {
  await ensureIndexes(db);
  const approved = remote.filter((row) => String(row.status || '').toUpperCase() === 'APPROVED' && row.name);
  for (const row of approved) {
    const name = String(row.name);
    const language = String(row.language || 'en');
    const existing = await db.collection(GROWTH_TEMPLATES_COLLECTION).findOne({ name, language }) as GrowthTemplate | null;
    const doc: GrowthTemplate = {
      id: existing?.id || uuidv4(),
      name,
      language,
      status: 'APPROVED',
      metaId: String(row.id || ''),
      updatedAt: new Date().toISOString(),
    };
    if (existing) await db.collection(GROWTH_TEMPLATES_COLLECTION).updateOne({ name, language }, { $set: doc });
    else await db.collection(GROWTH_TEMPLATES_COLLECTION).insertOne({ ...doc });
  }
  return { templates: await listGrowthTemplates(db), approved: approved.length };
}

export async function listFollowUpBatches(db: Db): Promise<FollowUpBatch[]> {
  await ensureIndexes(db);
  const rows = await db.collection(GROWTH_FOLLOWUPS_COLLECTION).find({}).sort({ createdAt: -1 }).toArray();
  return (rows as unknown as FollowUpBatch[]).filter((row) => !row.deletedAt);
}

async function loadBatch(db: Db, id: string): Promise<FollowUpBatch | null> {
  const row = await db.collection(GROWTH_FOLLOWUPS_COLLECTION).findOne({ id }) as FollowUpBatch | null;
  if (!row || row.deletedAt) return null;
  return row;
}

export async function scheduleFollowUp(
  db: Db,
  input: { templateName: string; languageCode?: string; recipients: FollowUpRecipient[]; scheduledFor: string },
  actorId: string,
): Promise<FollowUpBatch> {
  await ensureIndexes(db);
  const template = (await listGrowthTemplates(db)).find((row) => row.name === input.templateName && row.status === 'APPROVED');
  if (!template) throw new Error('Choose an approved WhatsApp template. Sync templates from Meta first.');
  const recipients = input.recipients.filter((row) => row.phone.trim());
  if (!recipients.length) throw new Error('Add at least one recipient.');
  if (!input.scheduledFor.trim()) throw new Error('A follow-up time is required.');
  const bulk = recipients.length > 1;
  const doc: FollowUpBatch = {
    id: uuidv4(),
    templateName: template.name,
    languageCode: input.languageCode || template.language || 'en',
    recipients,
    scheduledFor: input.scheduledFor,
    status: bulk ? 'pending_approval' : 'approved',
    bulk,
    approvedBy: bulk ? '' : actorId,
    approvedAt: bulk ? null : new Date().toISOString(),
    deliveries: [],
    ...stampCreate({ id: actorId }),
  };
  await db.collection(GROWTH_FOLLOWUPS_COLLECTION).insertOne({ ...doc });
  return doc;
}

export async function approveFollowUpBatch(
  db: Db,
  id: string,
  isSuperAdmin: boolean,
  actor: { id: string; email?: string },
): Promise<FollowUpBatch> {
  if (!isSuperAdmin) throw new Error('Only a super admin can approve a bulk follow-up.');
  const current = await loadBatch(db, id);
  if (!current) throw new Error('Follow-up batch not found.');
  if (!current.bulk) return current;
  if (current.status === 'queued') throw new Error('This batch is already queued.');
  const next: FollowUpBatch = {
    ...current,
    status: 'approved',
    approvedBy: actor.id,
    approvedAt: new Date().toISOString(),
    ...stampUpdate({ id: actor.id }),
  };
  const stored = { ...next } as FollowUpBatch & { _id?: unknown };
  delete stored._id;
  await db.collection(GROWTH_FOLLOWUPS_COLLECTION).updateOne({ id }, { $set: stored });
  await appendOpsAudit(db, {
    actorId: actor.id,
    actorEmail: actor.email,
    action: 'growth.followup.approve',
    entity: 'ops_growth_followup_batch',
    entityId: id,
    before: { status: current.status },
    after: { status: 'approved', recipients: current.recipients.length },
  });
  return next;
}

export async function sendFollowUpBatch(
  db: Db,
  id: string,
  restricted: boolean,
  actor: { id: string; email?: string },
): Promise<FollowUpBatch> {
  const current = await loadBatch(db, id);
  if (!current) throw new Error('Follow-up batch not found.');
  if (current.bulk && current.status !== 'approved' && current.status !== 'blocked') {
    throw new Error('A bulk follow-up needs super-admin approval before it can send.');
  }
  try {
    assertOsWhatsAppSendAllowed(restricted);
  } catch (error) {
    const next: FollowUpBatch = { ...current, status: 'blocked', ...stampUpdate({ id: actor.id }) };
    const stored = { ...next } as FollowUpBatch & { _id?: unknown };
    delete stored._id;
    await db.collection(GROWTH_FOLLOWUPS_COLLECTION).updateOne({ id }, { $set: stored });
    throw error;
  }
  const deliveries = [];
  for (const recipient of current.recipients) {
    await enqueueFollowUpJob(db, {
      targetType: 'ops_lead',
      targetId: recipient.leadId || current.id,
      phone: recipient.phone,
      templateName: current.templateName,
      languageCode: current.languageCode,
      scheduledFor: current.scheduledFor,
      createdBy: actor.id,
      idempotencyKey: `growth:${current.id}:${recipient.phone}`,
    });
    deliveries.push({ phone: recipient.phone, status: 'queued' as const, detail: '' });
  }
  const next: FollowUpBatch = { ...current, status: 'queued', deliveries, ...stampUpdate({ id: actor.id }) };
  const stored = { ...next } as FollowUpBatch & { _id?: unknown };
  delete stored._id;
  await db.collection(GROWTH_FOLLOWUPS_COLLECTION).updateOne({ id }, { $set: stored });
  await appendOpsAudit(db, {
    actorId: actor.id,
    actorEmail: actor.email,
    action: 'growth.followup.send',
    entity: 'ops_growth_followup_batch',
    entityId: id,
    before: { status: current.status },
    after: { status: 'queued', recipients: current.recipients.length },
  });
  return next;
}

export async function recordFollowUpDelivery(
  db: Db,
  id: string,
  input: { phone: string; status: DeliveryStatus; detail?: string },
): Promise<FollowUpBatch | null> {
  const current = await loadBatch(db, id);
  if (!current) return null;
  const deliveries = current.deliveries.map((row) => row.phone === input.phone ? { ...row, status: input.status, detail: input.detail || '' } : row);
  if (!deliveries.some((row) => row.phone === input.phone)) {
    deliveries.push({ phone: input.phone, status: input.status, detail: input.detail || '' });
  }
  const next: FollowUpBatch = { ...current, deliveries, updatedAt: new Date().toISOString() };
  const stored = { ...next } as FollowUpBatch & { _id?: unknown };
  delete stored._id;
  await db.collection(GROWTH_FOLLOWUPS_COLLECTION).updateOne({ id }, { $set: stored });
  return next;
}

export async function getFollowUpGrowthDb(): Promise<Db> {
  return getDb();
}
