/**
 * Phase 7 Campaign Studio. Proposals are template-based. Meta create stays paused.
 * Run: npx tsx scripts/os-phase7-campaign-studio.test.ts
 */
import assert from 'node:assert/strict';
import { saveDeveloperProject } from '../lib/ops/projects/store';
import { RESALE_UNITS_COLLECTION } from '../lib/ops/projects/types';
import {
  approvalForInventory,
  budgetAfterReview,
  buildCampaignProposal,
  metaCreateGate,
  suggestDailyBudgetInr,
} from '../lib/ops/growth/campaign-studio/proposal';
import {
  activateGrowthCampaign,
  createGrowthProposal,
  createPausedGrowthCampaign,
  listApprovedCampaignInventory,
  reviewGrowthCampaign,
} from '../lib/ops/growth/campaign-studio/store';
import { growthModuleEnabled } from '../lib/ops/os/flags';
import { growthAllowsHref } from '../lib/ops/os/nav';
import { OPS_AUDIT_COLLECTION } from '../lib/ops/os/audit';
import { createMemoryDb } from './lib/memory-db';

async function main() {
  assert.equal(growthModuleEnabled('CAMPAIGN_STUDIO'), false);
  assert.equal(growthAllowsHref('/ops/growth/campaigns', new Set()), false);
  assert.equal(growthAllowsHref('/ops/ads', new Set()), true);
  assert.equal(approvalForInventory({ kind: 'developer_project', status: 'sold_out', channelPartnerStatus: 'empanelled' }).approved, false);
  assert.equal(suggestDailyBudgetInr({ intent: 'rent', priceCrore: 4 }), 800);
  assert.throws(() => budgetAfterReview(1500, 2000), /cannot be higher/);

  const closed = metaCreateGate({ canPublishPaused: false, permissions: [], blockers: ['META_ADS_ENABLED is not true.'] });
  assert.equal(closed.available, false);

  const db = createMemoryDb();
  await saveDeveloperProject(db as never, {
    slug: 'oberai',
    name: 'Oberai Gardens',
    patch: {
      locality: 'Goregaon',
      channelPartnerStatus: 'empanelled',
      status: 'ready',
      configLabel: '3 BHK',
      possession: 'Dec 2027',
      priceLabel: '₹2.4 Cr',
      priceMinCrore: 2.4,
    },
  }, 'super-1');
  await saveDeveloperProject(db as never, {
    slug: 'closed',
    name: 'Closed Tower',
    patch: { channelPartnerStatus: 'applied', status: 'ready', locality: 'Andheri' },
  }, 'super-1');
  await db.collection(RESALE_UNITS_COLLECTION).insertOne({
    id: 'unit-1',
    slug: 'unit-1',
    projectName: 'Palm Court',
    status: 'for_sale',
    listingType: 'resale',
    configLabel: '2 BHK',
    askingPriceCrore: 1.8,
    askingPriceLabel: '₹1.8 Cr',
    unitNumber: '1202',
    owner: { name: 'Private Owner', phone: '9811111111', email: '', whatsapp: '' },
  });

  const inventory = await listApprovedCampaignInventory(db as never);
  assert.equal(inventory.some((item) => item.name === 'Closed Tower'), false);
  const project = inventory.find((item) => item.name === 'Oberai Gardens');
  assert.ok(project);
  assert.equal(JSON.stringify(inventory).includes('9811111111'), false);
  assert.equal(JSON.stringify(inventory).includes('Private Owner'), false);
  const proposal = buildCampaignProposal(project!);
  assert.ok(proposal.copy.primaryText.includes('Oberai Gardens'));
  assert.ok(proposal.creativeBrief.visual.length > 0);
  assert.equal(proposal.budgetSuggestionInr, 1500);
  assert.deepEqual(buildCampaignProposal(project!).copy, proposal.copy);

  const saved = await createGrowthProposal(db as never, project!.id, 'sales-1');
  assert.equal(saved.status, 'draft');
  await assert.rejects(() => reviewGrowthCampaign(db as never, saved.id, { decision: 'approve', isSuperAdmin: false }, { id: 'sales-1' }), /super admin/);
  await assert.rejects(() => reviewGrowthCampaign(db as never, saved.id, { decision: 'approve', approvedBudgetInr: 5000, isSuperAdmin: true }, { id: 'super-1' }), /cannot be higher/);
  const approved = await reviewGrowthCampaign(db as never, saved.id, { decision: 'approve', approvedBudgetInr: 1000, isSuperAdmin: true }, { id: 'super-1', email: 'super@example.com' });
  assert.equal(approved.approvedBudgetInr, 1000);

  let published = 0;
  await assert.rejects(() => createPausedGrowthCampaign(db as never, saved.id, {
    isSuperAdmin: true,
    permissionsAvailable: false,
    publish: async () => {
      published += 1;
      return { ok: true, metaCampaignId: '1' };
    },
  }, { id: 'super-1' }), /nothing was created/);
  assert.equal(published, 0);

  const paused = await createPausedGrowthCampaign(db as never, saved.id, {
    isSuperAdmin: true,
    permissionsAvailable: true,
    publish: async (input) => {
      assert.equal(input.dailyBudgetInr, 1000);
      published += 1;
      return { ok: true, metaCampaignId: '9988', metaAdSetId: '77', metaAdId: '66' };
    },
  }, { id: 'super-1', email: 'super@example.com' });
  assert.equal(published, 1);
  assert.equal(paused.status, 'paused_on_meta');
  assert.equal(paused.metaStatus, 'PAUSED');
  assert.equal(paused.approvedBudgetInr, 1000);

  let activated = 0;
  await assert.rejects(() => activateGrowthCampaign(db as never, saved.id, {
    isSuperAdmin: true,
    confirm: 'yes',
    permissionsAvailable: true,
    activeSpendAllowed: true,
    activate: async () => { activated += 1; },
  }, { id: 'super-1' }), /ACTIVATE/);
  await assert.rejects(() => activateGrowthCampaign(db as never, saved.id, {
    isSuperAdmin: true,
    confirm: 'ACTIVATE',
    permissionsAvailable: true,
    activeSpendAllowed: false,
    activate: async () => { activated += 1; },
  }, { id: 'super-1' }), /stays paused/);
  assert.equal(activated, 0);

  const live = await activateGrowthCampaign(db as never, saved.id, {
    isSuperAdmin: true,
    confirm: 'ACTIVATE',
    permissionsAvailable: true,
    activeSpendAllowed: true,
    activate: async ({ objectId }) => {
      assert.equal(objectId, '9988');
      activated += 1;
    },
  }, { id: 'super-1', email: 'super@example.com' });
  assert.equal(activated, 1);
  assert.equal(live.status, 'active');
  assert.equal(live.approvedBudgetInr, 1000);
  const audits = await db.collection(OPS_AUDIT_COLLECTION).find({}).toArray();
  assert.ok(audits.some((row) => row.action === 'growth.campaign.approve'));
  assert.ok(audits.some((row) => row.action === 'growth.campaign.create_paused'));
  assert.ok(audits.some((row) => row.action === 'growth.campaign.activate'));

  console.log('os-phase7-campaign-studio: ok');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
