import { v4 as uuidv4 } from 'uuid';
import type { Db } from 'mongodb';
// @ts-expect-error JS module without types
import { getDb } from '@/lib/mongodb';
import { CONTACTS_COLLECTION } from '@/lib/ops/contacts/types';
import { appendOpsAudit } from '@/lib/ops/os/audit';
import { stampCreate, stampUpdate } from '@/lib/ops/os/records';
import {
  applyReviewDecision,
  findDuplicateGroups,
  reviewKey,
  type ContactPhoneRef,
  type DuplicateReview,
  type ReviewDecision,
} from '@/lib/ops/workspace/duplicates';

export const DUPLICATE_REVIEWS_COLLECTION = 'contact_duplicate_reviews';
export const AGREEMENT_TERMS_COLLECTION = 'ops_agreement_terms';

export type AgreementTerms = {
  id: string;
  agreementId: string;
  rent: string;
  deposit: string;
  lockInMonths: number | null;
  noticeDays: number | null;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

let indexesReady = false;

async function ensureIndexes(db: Db): Promise<void> {
  if (indexesReady) return;
  await db.collection(DUPLICATE_REVIEWS_COLLECTION).createIndex({ id: 1 }, { unique: true });
  await db.collection(DUPLICATE_REVIEWS_COLLECTION).createIndex({ phone: 1, status: 1 });
  await db.collection(AGREEMENT_TERMS_COLLECTION).createIndex({ id: 1 }, { unique: true });
  await db.collection(AGREEMENT_TERMS_COLLECTION).createIndex({ agreementId: 1 }, { unique: true });
  indexesReady = true;
}

export async function getWorkspaceDb(): Promise<Db> {
  return getDb();
}

export async function queueDuplicateReviews(db: Db, actorId: string): Promise<{ created: number; open: number }> {
  await ensureIndexes(db);
  const docs = await db.collection(CONTACTS_COLLECTION).find({}, { projection: { _id: 0, id: 1, phones: 1 } }).toArray();
  const contacts: ContactPhoneRef[] = docs.map((doc) => ({
    id: String((doc as { id?: string }).id || ''),
    phones: Array.isArray((doc as { phones?: unknown }).phones) ? (doc as { phones: string[] }).phones.map(String) : [],
  })).filter((contact) => contact.id);
  const groups = findDuplicateGroups(contacts);
  const existing = await db.collection(DUPLICATE_REVIEWS_COLLECTION).find({}).toArray();
  const known = new Set(existing.map((row) => reviewKey(String(row.phone || ''), (row.contactIds as string[]) || [])));
  let created = 0;
  for (const group of groups) {
    if (known.has(reviewKey(group.phone, group.contactIds))) continue;
    const review: DuplicateReview = {
      id: uuidv4(),
      phone: group.phone,
      contactIds: group.contactIds,
      status: 'open',
      decision: '',
      ...stampCreate({ id: actorId }),
    };
    await db.collection(DUPLICATE_REVIEWS_COLLECTION).insertOne({ ...review });
    created += 1;
  }
  const open = existing.filter((row) => row.status === 'open' && !row.deletedAt).length + created;
  return { created, open };
}

export async function listDuplicateReviews(db: Db): Promise<DuplicateReview[]> {
  await ensureIndexes(db);
  const rows = await db.collection(DUPLICATE_REVIEWS_COLLECTION).find({}).sort({ createdAt: -1 }).toArray();
  return (rows as unknown as DuplicateReview[]).filter((row) => !row.deletedAt);
}

export async function resolveDuplicateReview(
  db: Db,
  id: string,
  decision: ReviewDecision,
  actor: { id: string; email?: string },
): Promise<DuplicateReview | null> {
  await ensureIndexes(db);
  const current = await db.collection(DUPLICATE_REVIEWS_COLLECTION).findOne({ id }) as DuplicateReview | null;
  if (!current || current.deletedAt) return null;
  const next = applyReviewDecision(current, decision, actor.id);
  const stored = { ...next } as DuplicateReview & { _id?: unknown };
  delete stored._id;
  await db.collection(DUPLICATE_REVIEWS_COLLECTION).updateOne({ id }, { $set: stored });
  await appendOpsAudit(db, {
    actorId: actor.id,
    actorEmail: actor.email,
    action: 'duplicate_review_resolved',
    entity: DUPLICATE_REVIEWS_COLLECTION,
    entityId: id,
    before: { status: current.status, decision: current.decision, contactIds: current.contactIds },
    after: { status: next.status, decision: next.decision, contactIds: next.contactIds, merged: false },
  });
  return next;
}

export async function saveAgreementTerms(
  db: Db,
  input: { agreementId: string; rent?: string; deposit?: string; lockInMonths?: number | null; noticeDays?: number | null },
  actorId: string,
): Promise<AgreementTerms> {
  await ensureIndexes(db);
  const agreementId = input.agreementId.trim();
  if (!agreementId) throw new Error('An agreement id is required.');
  const existing = await db.collection(AGREEMENT_TERMS_COLLECTION).findOne({ agreementId }) as AgreementTerms | null;
  const now = stampUpdate({ id: actorId });
  if (!existing) {
    const created: AgreementTerms = {
      id: uuidv4(),
      agreementId,
      rent: input.rent?.trim() || '',
      deposit: input.deposit?.trim() || '',
      lockInMonths: input.lockInMonths ?? null,
      noticeDays: input.noticeDays ?? null,
      ...stampCreate({ id: actorId }),
    };
    await db.collection(AGREEMENT_TERMS_COLLECTION).insertOne({ ...created });
    return created;
  }
  const next: AgreementTerms = {
    ...existing,
    rent: input.rent != null ? input.rent.trim() : existing.rent,
    deposit: input.deposit != null ? input.deposit.trim() : existing.deposit,
    lockInMonths: input.lockInMonths !== undefined ? input.lockInMonths : existing.lockInMonths,
    noticeDays: input.noticeDays !== undefined ? input.noticeDays : existing.noticeDays,
    ...now,
    createdAt: existing.createdAt,
    createdBy: existing.createdBy,
  };
  const stored = { ...next } as AgreementTerms & { _id?: unknown };
  delete stored._id;
  await db.collection(AGREEMENT_TERMS_COLLECTION).updateOne({ agreementId }, { $set: stored });
  return next;
}

export async function listAgreementTerms(db: Db): Promise<AgreementTerms[]> {
  await ensureIndexes(db);
  const rows = await db.collection(AGREEMENT_TERMS_COLLECTION).find({}).toArray();
  return (rows as unknown as AgreementTerms[]).filter((row) => !row.deletedAt);
}

export async function workspaceSummary(db: Db): Promise<{
  openDuplicateReviews: number;
  agreementTerms: number;
}> {
  const [reviews, terms] = await Promise.all([
    listDuplicateReviews(db),
    listAgreementTerms(db),
  ]);
  return {
    openDuplicateReviews: reviews.filter((review) => review.status === 'open').length,
    agreementTerms: terms.length,
  };
}
