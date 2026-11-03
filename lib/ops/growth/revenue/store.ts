import { v4 as uuidv4 } from 'uuid';
import type { Db } from 'mongodb';
import { getDb } from '@/lib/mongodb';
import { listPayments } from '@/lib/ops/finance/store';
import { listGrowthCaptures } from '@/lib/ops/growth/capture/store';
import { listGrowthCampaigns } from '@/lib/ops/growth/campaign-studio/store';
import { listDemandProfiles } from '@/lib/ops/growth/demand/store';
import { attributeCampaign, type AttributionLink } from '@/lib/ops/growth/revenue/attribute';
import { listSiteVisits } from '@/lib/ops/visits/store';
import { stampCreate } from '@/lib/ops/os/records';

export const ATTRIBUTION_LINKS_COLLECTION = 'ops_growth_attribution_links';

export type SpendRow = { campaignId: string; campaignName?: string; spend: number };

let indexesReady = false;

async function ensureIndexes(db: Db): Promise<void> {
  if (indexesReady) return;
  await db.collection(ATTRIBUTION_LINKS_COLLECTION).createIndex({ id: 1 }, { unique: true });
  await db.collection(ATTRIBUTION_LINKS_COLLECTION).createIndex({ leadId: 1, dealId: 1 }, { unique: true });
  indexesReady = true;
}

export async function linkLeadToDeal(db: Db, input: { leadId: string; dealId: string }, actorId: string): Promise<AttributionLink & { id: string }> {
  await ensureIndexes(db);
  const leadId = input.leadId.trim();
  const dealId = input.dealId.trim();
  if (!leadId || !dealId) throw new Error('A lead and a deal are required.');
  const existing = await db.collection(ATTRIBUTION_LINKS_COLLECTION).findOne({ leadId, dealId });
  if (existing) return { id: String(existing.id), leadId, dealId };
  const doc = { id: uuidv4(), leadId, dealId, ...stampCreate({ id: actorId }) };
  await db.collection(ATTRIBUTION_LINKS_COLLECTION).insertOne({ ...doc });
  return { id: doc.id, leadId, dealId };
}

export async function buildRevenueReport(db: Db, spend: { rows: SpendRow[] | null; error: string }) {
  const [captures, profiles, visits, payments, campaigns, linkRows, deals] = await Promise.all([
    listGrowthCaptures(db),
    listDemandProfiles(db),
    listSiteVisits(db),
    listPayments(db),
    listGrowthCampaigns(db),
    db.collection(ATTRIBUTION_LINKS_COLLECTION).find({}).toArray(),
    db.collection('ops_deals').find({}).toArray(),
  ]);
  const qualifiedIds = new Set(profiles.filter((row) => row.configuration && (row.budgetMin != null || row.budgetMax != null || row.intent)).map((row) => row.sourceEventId));
  const leads = captures.map((row) => ({ id: row.id, campaignId: row.campaignId, qualified: qualifiedIds.has(row.id) }));
  const campaignIds = new Set<string>();
  for (const lead of leads) if (lead.campaignId) campaignIds.add(lead.campaignId);
  for (const row of spend.rows || []) if (row.campaignId) campaignIds.add(row.campaignId);
  const reports = [...campaignIds].map((campaignId) => {
    const campaign = campaigns.find((row) => row.metaCampaignId === campaignId || row.id === campaignId);
    const spendRow = spend.rows?.find((row) => row.campaignId === campaignId);
    return attributeCampaign({
      campaignId,
      projectName: campaign?.projectName || spendRow?.campaignName || '',
      spend: spend.rows == null ? null : spendRow?.spend ?? 0,
      spendError: spend.error,
      leads,
      visits: visits.map((row) => ({ id: row.id, dealId: row.dealId, status: row.status })),
      deals: deals.map((row) => ({ id: String(row.id || ''), project: String(row.project || '') })),
      payments,
      links: linkRows.map((row) => ({ leadId: String(row.leadId || ''), dealId: String(row.dealId || '') })),
    });
  });
  return { reports, spendAvailable: spend.rows != null, spendError: spend.error };
}

export async function getRevenueGrowthDb(): Promise<Db> {
  return getDb();
}
