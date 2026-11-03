import { v4 as uuidv4 } from 'uuid';
import type { Db } from 'mongodb';
import { getDb } from '@/lib/mongodb';
import { listApartments, listRentals } from '@/lib/ops/inventory/store';
import { listDeveloperProjects, listResaleUnits } from '@/lib/ops/projects/store';
import { appendOpsAudit } from '@/lib/ops/os/audit';
import { stampCreate, stampUpdate } from '@/lib/ops/os/records';
import {
  ACTIVATE_PHRASE,
  approvalForInventory,
  assertCanActivate,
  assertCanCreatePaused,
  assertCanReview,
  budgetAfterReview,
  buildCampaignProposal,
  type CampaignCopy,
  type CampaignInventory,
  type CampaignInventoryKind,
} from '@/lib/ops/growth/campaign-studio/proposal';

export const GROWTH_CAMPAIGNS_COLLECTION = 'ops_growth_campaigns';

export type GrowthCampaignStatus = 'draft' | 'approved' | 'rejected' | 'paused_on_meta' | 'active';

export type GrowthCampaign = {
  id: string;
  inventoryId: string;
  inventoryKind: CampaignInventoryKind;
  projectName: string;
  locality: string;
  copy: CampaignCopy;
  audience: { localities: string[]; configuration: string; intent: 'buy' | 'rent' };
  budgetSuggestionInr: number;
  approvedBudgetInr: number | null;
  creativeBrief: { angle: string; visual: string; offer: string };
  status: GrowthCampaignStatus;
  metaCampaignId: string;
  metaAdSetId: string;
  metaAdId: string;
  metaStatus: 'NONE' | 'PAUSED' | 'ACTIVE';
  lastError: string;
  approvedBy: string;
  approvedAt: string | null;
  activatedBy: string;
  activatedAt: string | null;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type PausedPublishResult = {
  ok: boolean;
  metaCampaignId?: string;
  metaAdSetId?: string;
  metaAdId?: string;
  error?: string;
};

export type PausedPublisher = (input: {
  name: string;
  dailyBudgetInr: number;
  copy: CampaignCopy;
  areas: string[];
}) => Promise<PausedPublishResult>;

export type ActivatePublisher = (input: { objectId: string }) => Promise<void>;

let indexesReady = false;

async function ensureIndexes(db: Db): Promise<void> {
  if (indexesReady) return;
  await db.collection(GROWTH_CAMPAIGNS_COLLECTION).createIndex({ id: 1 }, { unique: true });
  await db.collection(GROWTH_CAMPAIGNS_COLLECTION).createIndex({ status: 1, updatedAt: -1 });
  indexesReady = true;
}

export async function getGrowthDb(): Promise<Db> {
  return getDb();
}

export async function listApprovedCampaignInventory(db: Db): Promise<CampaignInventory[]> {
  const [projects, units, rentals, apartments] = await Promise.all([
    listDeveloperProjects(db),
    listResaleUnits(db),
    listRentals(db),
    listApartments(db),
  ]);
  const items: CampaignInventory[] = [];
  for (const project of projects) {
    const gate = approvalForInventory({
      kind: 'developer_project',
      status: project.status,
      channelPartnerStatus: project.channelPartnerStatus,
    });
    if (!gate.approved) continue;
    items.push({
      id: project.id,
      kind: 'developer_project',
      name: project.name,
      locality: project.locality,
      configuration: project.configLabel,
      possession: project.possession,
      intent: 'buy',
      priceLabel: project.priceLabel,
      priceCrore: project.priceMinCrore,
      approvedBecause: gate.because,
    });
  }
  for (const unit of units) {
    const gate = approvalForInventory({ kind: 'resale_unit', status: unit.status });
    if (!gate.approved) continue;
    const rent = unit.listingType === 'rental' || unit.status === 'for_rent';
    items.push({
      id: unit.id,
      kind: 'resale_unit',
      name: unit.projectName,
      locality: '',
      configuration: unit.configLabel || (unit.bhk ? `${unit.bhk} BHK` : ''),
      possession: 'Ready',
      intent: rent ? 'rent' : 'buy',
      priceLabel: unit.askingPriceLabel,
      priceCrore: unit.askingPriceCrore,
      approvedBecause: gate.because,
    });
  }
  for (const rental of rentals) {
    const gate = approvalForInventory({ kind: 'rental', status: rental.status });
    if (!gate.approved) continue;
    const apartment = apartments.find((row) => row.id === rental.apartmentId);
    items.push({
      id: rental.id,
      kind: 'rental',
      name: apartment?.projectName || 'Rental',
      locality: '',
      configuration: '',
      possession: 'Ready',
      intent: 'rent',
      priceLabel: rental.rent,
      priceCrore: null,
      approvedBecause: gate.because,
    });
  }
  return items;
}

function stripId<T extends { id: string }>(row: T): T {
  const stored = { ...row } as T & { _id?: unknown };
  delete stored._id;
  return stored;
}

export async function listGrowthCampaigns(db: Db): Promise<GrowthCampaign[]> {
  await ensureIndexes(db);
  const rows = await db.collection(GROWTH_CAMPAIGNS_COLLECTION).find({}).sort({ updatedAt: -1 }).toArray();
  return (rows as unknown as GrowthCampaign[]).filter((row) => !row.deletedAt);
}

async function loadCampaign(db: Db, id: string): Promise<GrowthCampaign | null> {
  await ensureIndexes(db);
  const row = await db.collection(GROWTH_CAMPAIGNS_COLLECTION).findOne({ id }) as unknown as GrowthCampaign | null;
  if (!row || row.deletedAt) return null;
  return row;
}

export async function createGrowthProposal(db: Db, inventoryId: string, actorId: string): Promise<GrowthCampaign> {
  const inventory = await listApprovedCampaignInventory(db);
  const item = inventory.find((row) => row.id === inventoryId);
  if (!item) throw new Error('Choose an approved project or listing.');
  const draft = buildCampaignProposal(item);
  const doc: GrowthCampaign = {
    id: uuidv4(),
    ...draft,
    approvedBudgetInr: null,
    status: 'draft',
    metaCampaignId: '',
    metaAdSetId: '',
    metaAdId: '',
    metaStatus: 'NONE',
    lastError: '',
    approvedBy: '',
    approvedAt: null,
    activatedBy: '',
    activatedAt: null,
    ...stampCreate({ id: actorId }),
  };
  await db.collection(GROWTH_CAMPAIGNS_COLLECTION).insertOne({ ...doc });
  return doc;
}

export async function reviewGrowthCampaign(
  db: Db,
  id: string,
  input: { decision: 'approve' | 'reject'; approvedBudgetInr?: number | null; isSuperAdmin: boolean },
  actor: { id: string; email?: string },
): Promise<GrowthCampaign> {
  assertCanReview(input.isSuperAdmin);
  const current = await loadCampaign(db, id);
  if (!current) throw new Error('Proposal not found.');
  if (current.status !== 'draft') throw new Error('Only a draft proposal can be reviewed.');
  const now = new Date().toISOString();
  const next: GrowthCampaign = input.decision === 'reject'
    ? { ...current, status: 'rejected', ...stampUpdate({ id: actor.id }) }
    : {
      ...current,
      status: 'approved',
      approvedBudgetInr: budgetAfterReview(current.budgetSuggestionInr, input.approvedBudgetInr),
      approvedBy: actor.id,
      approvedAt: now,
      ...stampUpdate({ id: actor.id }),
    };
  await db.collection(GROWTH_CAMPAIGNS_COLLECTION).updateOne({ id }, { $set: stripId(next) });
  await appendOpsAudit(db, {
    actorId: actor.id,
    actorEmail: actor.email,
    action: input.decision === 'reject' ? 'growth.campaign.reject' : 'growth.campaign.approve',
    entity: 'ops_growth_campaign',
    entityId: id,
    before: { status: current.status, approvedBudgetInr: current.approvedBudgetInr },
    after: { status: next.status, approvedBudgetInr: next.approvedBudgetInr },
  });
  return next;
}

export async function createPausedGrowthCampaign(
  db: Db,
  id: string,
  input: { isSuperAdmin: boolean; permissionsAvailable: boolean; publish: PausedPublisher },
  actor: { id: string; email?: string },
): Promise<GrowthCampaign> {
  const current = await loadCampaign(db, id);
  if (!current) throw new Error('Proposal not found.');
  assertCanCreatePaused({
    isSuperAdmin: input.isSuperAdmin,
    status: current.status,
    permissionsAvailable: input.permissionsAvailable,
  });
  const budget = current.approvedBudgetInr ?? current.budgetSuggestionInr;
  if (budget > current.budgetSuggestionInr) throw new Error('The approved budget cannot be higher than the suggestion.');
  const published = await input.publish({
    name: `${current.projectName} — ${current.locality || 'Mumbai'}`,
    dailyBudgetInr: budget,
    copy: current.copy,
    areas: current.audience.localities,
  });
  if (!published.ok || !published.metaCampaignId) {
    const next: GrowthCampaign = {
      ...current,
      lastError: published.error || 'Meta did not accept a paused campaign.',
      ...stampUpdate({ id: actor.id }),
    };
    await db.collection(GROWTH_CAMPAIGNS_COLLECTION).updateOne({ id }, { $set: stripId(next) });
    return next;
  }
  const next: GrowthCampaign = {
    ...current,
    status: 'paused_on_meta',
    metaStatus: 'PAUSED',
    metaCampaignId: published.metaCampaignId,
    metaAdSetId: published.metaAdSetId || '',
    metaAdId: published.metaAdId || '',
    approvedBudgetInr: budget,
    lastError: '',
    ...stampUpdate({ id: actor.id }),
  };
  await db.collection(GROWTH_CAMPAIGNS_COLLECTION).updateOne({ id }, { $set: stripId(next) });
  await appendOpsAudit(db, {
    actorId: actor.id,
    actorEmail: actor.email,
    action: 'growth.campaign.create_paused',
    entity: 'ops_growth_campaign',
    entityId: id,
    before: { status: current.status, metaStatus: current.metaStatus },
    after: { status: 'paused_on_meta', metaStatus: 'PAUSED', metaCampaignId: next.metaCampaignId, dailyBudgetInr: budget },
  });
  return next;
}

export async function activateGrowthCampaign(
  db: Db,
  id: string,
  input: {
    isSuperAdmin: boolean;
    confirm: string;
    permissionsAvailable: boolean;
    activeSpendAllowed: boolean;
    activate: ActivatePublisher;
  },
  actor: { id: string; email?: string },
): Promise<GrowthCampaign> {
  const current = await loadCampaign(db, id);
  if (!current) throw new Error('Proposal not found.');
  const budgetBefore = current.approvedBudgetInr;
  assertCanActivate({
    isSuperAdmin: input.isSuperAdmin,
    confirm: input.confirm,
    status: current.status,
    metaStatus: current.metaStatus,
    permissionsAvailable: input.permissionsAvailable,
    activeSpendAllowed: input.activeSpendAllowed,
  });
  if (input.confirm !== ACTIVATE_PHRASE) {
    throw new Error('Type ACTIVATE to confirm. Campaigns are never activated automatically.');
  }
  try {
    await input.activate({ objectId: current.metaCampaignId });
  } catch (error) {
    const next: GrowthCampaign = {
      ...current,
      lastError: error instanceof Error ? error.message : 'Meta refused activation. The campaign stays paused.',
      ...stampUpdate({ id: actor.id }),
    };
    await db.collection(GROWTH_CAMPAIGNS_COLLECTION).updateOne({ id }, { $set: stripId(next) });
    return next;
  }
  const next: GrowthCampaign = {
    ...current,
    status: 'active',
    metaStatus: 'ACTIVE',
    approvedBudgetInr: budgetBefore,
    activatedBy: actor.id,
    activatedAt: new Date().toISOString(),
    lastError: '',
    ...stampUpdate({ id: actor.id }),
  };
  await db.collection(GROWTH_CAMPAIGNS_COLLECTION).updateOne({ id }, { $set: stripId(next) });
  await appendOpsAudit(db, {
    actorId: actor.id,
    actorEmail: actor.email,
    action: 'growth.campaign.activate',
    entity: 'ops_growth_campaign',
    entityId: id,
    before: { status: 'paused_on_meta', metaStatus: 'PAUSED', approvedBudgetInr: budgetBefore },
    after: { status: 'active', metaStatus: 'ACTIVE', approvedBudgetInr: next.approvedBudgetInr, confirm: ACTIVATE_PHRASE },
  });
  return next;
}
