import { v4 as uuidv4 } from 'uuid';
import type { Db } from 'mongodb';
import { getDb } from '@/lib/mongodb';
import { createRequirement } from '@/lib/ops/crm/requirements-store';
import { listApprovedCampaignInventory } from '@/lib/ops/growth/campaign-studio/store';
import { mapLeadAnswers, matchInventory, type DemandFields, type InventoryOffer } from '@/lib/ops/growth/demand/profile';
import { stampCreate } from '@/lib/ops/os/records';

export const DEMAND_PROFILES_COLLECTION = 'ops_growth_demand_profiles';

export type DemandProfile = DemandFields & {
  id: string;
  contactId: string;
  requirementId: string;
  sourceEventId: string;
  answers: Record<string, string>;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

let indexesReady = false;

async function ensureIndexes(db: Db): Promise<void> {
  if (indexesReady) return;
  await db.collection(DEMAND_PROFILES_COLLECTION).createIndex({ id: 1 }, { unique: true });
  await db.collection(DEMAND_PROFILES_COLLECTION).createIndex({ contactId: 1, updatedAt: -1 });
  indexesReady = true;
}

function moneyLabel(value: number | null): string {
  if (value == null) return '';
  return String(value);
}

export async function listDemandProfiles(db: Db): Promise<DemandProfile[]> {
  await ensureIndexes(db);
  const rows = await db.collection(DEMAND_PROFILES_COLLECTION).find({}).sort({ updatedAt: -1 }).toArray();
  return (rows as unknown as DemandProfile[]).filter((row) => !row.deletedAt);
}

export async function saveDemandProfile(
  db: Db,
  input: {
    answers?: Record<string, string>;
    contactId?: string;
    sourceEventId?: string;
    budgetMin?: number | null;
    budgetMax?: number | null;
    configuration?: string;
    location?: string;
    possession?: string;
    intent?: DemandFields['intent'];
  },
  actorId: string,
): Promise<{ profile: DemandProfile; contactUpdated: false }> {
  await ensureIndexes(db);
  const mapped = mapLeadAnswers(input.answers || {});
  const fields: DemandFields = {
    budgetMin: input.budgetMin === undefined ? mapped.budgetMin : input.budgetMin,
    budgetMax: input.budgetMax === undefined ? mapped.budgetMax : input.budgetMax,
    configuration: input.configuration === undefined ? mapped.configuration : input.configuration.trim(),
    location: input.location === undefined ? mapped.location : input.location.trim(),
    possession: input.possession === undefined ? mapped.possession : input.possession.trim(),
    intent: input.intent === undefined ? mapped.intent : input.intent,
  };
  if (!fields.configuration && !fields.location && !fields.intent && fields.budgetMin == null) {
    throw new Error('Add a budget, configuration, location, possession, or intent.');
  }
  const requirement = await createRequirement(db, {
    clientName: fields.configuration || fields.location ? '' : 'Demand profile',
    bhk: fields.configuration.replace(/\s*BHK/i, ''),
    localities: fields.location ? [fields.location] : [],
    budgetMin: moneyLabel(fields.budgetMin),
    budgetMax: moneyLabel(fields.budgetMax),
    notes: [fields.intent && `Intent: ${fields.intent}`, fields.possession && `Possession: ${fields.possession}`].filter(Boolean).join('. '),
    assignedTo: actorId,
  }, actorId);
  const beforeContacts = await db.collection('contacts').countDocuments(input.contactId ? { id: input.contactId } : {});
  const doc: DemandProfile = {
    id: uuidv4(),
    ...fields,
    contactId: input.contactId?.trim() || '',
    requirementId: requirement.id,
    sourceEventId: input.sourceEventId?.trim() || '',
    answers: input.answers || {},
    ...stampCreate({ id: actorId }),
  };
  await db.collection(DEMAND_PROFILES_COLLECTION).insertOne({ ...doc });
  const afterContacts = await db.collection('contacts').countDocuments(input.contactId ? { id: input.contactId } : {});
  if (afterContacts !== beforeContacts) {
    throw new Error('Saving a demand profile must not create or edit a contact.');
  }
  return { profile: doc, contactUpdated: false };
}

export async function inventoryOffers(db: Db): Promise<InventoryOffer[]> {
  const inventory = await listApprovedCampaignInventory(db);
  return inventory.map((item) => {
    const point = item.priceCrore == null ? null : Math.round(item.priceCrore * 10000000);
    return {
      id: item.id,
      name: item.name,
      locality: item.locality,
      configuration: item.configuration,
      possession: item.possession,
      intent: item.intent,
      budgetMin: point == null ? null : Math.round(point * 0.85),
      budgetMax: point,
    };
  });
}

export async function profileMatches(db: Db, profileId: string) {
  const profile = (await listDemandProfiles(db)).find((row) => row.id === profileId);
  if (!profile) return null;
  return { profile, matches: matchInventory(profile, await inventoryOffers(db)) };
}

export async function getGrowthDb(): Promise<Db> {
  return getDb();
}
