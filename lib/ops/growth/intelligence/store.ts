import { v4 as uuidv4 } from 'uuid';
import type { Db } from 'mongodb';
import { getDb } from '@/lib/mongodb';
import { CONTACTS_COLLECTION } from '@/lib/ops/contacts/types';
import { GROWTH_CAPTURE_COLLECTION, type GrowthCapture } from '@/lib/ops/growth/capture/store';
import { listDemandProfiles } from '@/lib/ops/growth/demand/store';
import { matchInventory } from '@/lib/ops/growth/demand/profile';
import { inventoryOffers } from '@/lib/ops/growth/demand/store';
import { DEFAULT_SCORE_WEIGHTS, sanitizeWeights, scoreEngagement, scoreQualification, type ScoreWeights } from '@/lib/ops/growth/intelligence/scores';
import { appendOpsAudit } from '@/lib/ops/os/audit';
import { stampCreate } from '@/lib/ops/os/records';
import { normalizeIndianMobile } from '@/lib/phone/indian-mobile';
import { DUPLICATE_REVIEWS_COLLECTION } from '@/lib/ops/workspace/store';
import { reviewKey, type DuplicateReview } from '@/lib/ops/workspace/duplicates';

export const SCORE_WEIGHTS_COLLECTION = 'ops_growth_score_weights';
const WEIGHTS_ID = 'default';

export async function getScoreWeights(db: Db): Promise<ScoreWeights> {
  const row = await db.collection(SCORE_WEIGHTS_COLLECTION).findOne({ id: WEIGHTS_ID });
  if (!row) return DEFAULT_SCORE_WEIGHTS;
  return sanitizeWeights(row as Partial<ScoreWeights>);
}

export async function saveScoreWeights(db: Db, weights: Partial<ScoreWeights>, actor: { id: string; email?: string }): Promise<ScoreWeights> {
  const next = sanitizeWeights(weights);
  const before = await getScoreWeights(db);
  await db.collection(SCORE_WEIGHTS_COLLECTION).updateOne(
    { id: WEIGHTS_ID },
    { $set: { id: WEIGHTS_ID, ...next, updatedAt: new Date().toISOString(), updatedBy: actor.id } },
    { upsert: true },
  );
  await appendOpsAudit(db, {
    actorId: actor.id,
    actorEmail: actor.email,
    action: 'growth.intelligence.weights',
    entity: 'ops_growth_score_weights',
    entityId: WEIGHTS_ID,
    before: before as unknown as Record<string, unknown>,
    after: next as unknown as Record<string, unknown>,
  });
  return next;
}

export async function queueLeadDuplicate(
  db: Db,
  input: { phone: string; leadId: string; actorId: string },
): Promise<{ created: boolean; merged: false; reviewId: string }> {
  const phone = normalizeIndianMobile(input.phone);
  if (!phone) return { created: false, merged: false, reviewId: '' };
  const contacts = await db.collection(CONTACTS_COLLECTION).find({}).toArray();
  const contactIds = contacts
    .filter((row) => {
      const phones = Array.isArray(row.phones) ? row.phones.map(String) : [];
      return phones.map((value) => normalizeIndianMobile(value)).includes(phone);
    })
    .map((row) => String(row.id || ''))
    .filter(Boolean)
    .sort();
  if (!contactIds.length) return { created: false, merged: false, reviewId: '' };
  const key = reviewKey(phone, contactIds);
  const existing = await db.collection(DUPLICATE_REVIEWS_COLLECTION).find({ phone }).toArray();
  const known = existing.find((row) => reviewKey(String(row.phone || ''), (row.contactIds as string[]) || []) === key);
  if (known) {
    const leadIds = new Set<string>(Array.isArray(known.leadIds) ? known.leadIds.map(String) : []);
    leadIds.add(input.leadId);
    await db.collection(DUPLICATE_REVIEWS_COLLECTION).updateOne({ id: known.id }, { $set: { leadIds: [...leadIds] } });
    return { created: false, merged: false, reviewId: String(known.id || '') };
  }
  const review: DuplicateReview = {
    id: uuidv4(),
    phone,
    contactIds,
    leadIds: [input.leadId],
    status: 'open',
    decision: '',
    ...stampCreate({ id: input.actorId }),
  };
  await db.collection(DUPLICATE_REVIEWS_COLLECTION).insertOne({ ...review });
  return { created: true, merged: false, reviewId: review.id };
}

export async function explainLead(db: Db, lead: GrowthCapture) {
  const weights = await getScoreWeights(db);
  const profiles = await listDemandProfiles(db);
  const linked = profiles.find((row) => row.sourceEventId === lead.id);
  const offers = await inventoryOffers(db);
  const matches = linked ? matchInventory(linked, offers) : [];
  const reviews = await db.collection(DUPLICATE_REVIEWS_COLLECTION).find({ status: 'open' }).toArray();
  const openDuplicate = reviews.some((row) => Array.isArray(row.leadIds) && row.leadIds.includes(lead.id));
  const engagement = scoreEngagement({
    source: lead.source,
    replied: Boolean(lead.message),
    touches: lead.message ? 2 : 1,
  }, weights);
  const qualification = scoreQualification({
    budget: Boolean(linked?.budgetMin || linked?.budgetMax),
    configuration: Boolean(linked?.configuration),
    location: Boolean(linked?.location),
    possession: Boolean(linked?.possession),
    intent: Boolean(linked?.intent),
    inventoryMatch: matches.length > 0,
    openDuplicate,
  }, weights);
  return {
    leadId: lead.id,
    source: lead.source,
    campaignId: lead.campaignId,
    engagement,
    qualification,
    duplicateOpen: openDuplicate,
    merged: false as const,
  };
}

export async function explainCaptures(db: Db) {
  const leads = (await db.collection(GROWTH_CAPTURE_COLLECTION).find({}).toArray()) as unknown as GrowthCapture[];
  const rows = [];
  for (const lead of leads.filter((row) => !row.deletedAt)) rows.push(await explainLead(db, lead));
  return { weights: await getScoreWeights(db), rows };
}

export async function getIntelligenceDb(): Promise<Db> {
  return getDb();
}
