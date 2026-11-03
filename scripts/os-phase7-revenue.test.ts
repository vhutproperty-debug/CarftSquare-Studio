/**
 * Phase 7 revenue attribution. Collected brokerage is verified payments only.
 * Run: npx tsx scripts/os-phase7-revenue.test.ts
 */
import assert from 'node:assert/strict';
import { attributeCampaign } from '../lib/ops/growth/revenue/attribute';
import { buildRevenueReport, linkLeadToDeal } from '../lib/ops/growth/revenue/store';
import { GROWTH_CAPTURE_COLLECTION } from '../lib/ops/growth/capture/store';
import { DEMAND_PROFILES_COLLECTION } from '../lib/ops/growth/demand/store';
import { createMemoryDb } from './lib/memory-db';

async function main() {
  const row = attributeCampaign({
    campaignId: 'camp-1',
    projectName: 'Oberai Gardens',
    spend: 10000,
    leads: [
      { id: 'lead-1', campaignId: 'camp-1', qualified: true },
      { id: 'lead-2', campaignId: 'camp-1', qualified: false },
      { id: 'lead-3', campaignId: 'other', qualified: true },
    ],
    visits: [
      { id: 'visit-1', dealId: 'deal-1', status: 'completed' },
      { id: 'visit-2', dealId: 'deal-1', status: 'cancelled' },
    ],
    deals: [{ id: 'deal-1', project: 'Oberai Gardens' }, { id: 'deal-2', project: 'Elsewhere' }],
    payments: [
      { id: 'pay-1', dealId: 'deal-1', amount: 50000, verified: true },
      { id: 'pay-2', dealId: 'deal-1', amount: 20000, verified: false },
      { id: 'pay-3', dealId: 'deal-2', amount: 90000, verified: true },
    ],
    links: [],
  });
  assert.equal(row.qualifiedLeads, 1);
  assert.equal(row.siteVisits, 1);
  assert.equal(row.deals, 1);
  assert.equal(row.collected, 50000);
  assert.equal(row.costPerQualifiedLead, 10000);
  assert.equal(row.costPerSiteVisit, 10000);
  assert.equal(row.roi, 4);

  const unread = attributeCampaign({ ...{
    campaignId: 'camp-1',
    projectName: 'Oberai Gardens',
    spend: null,
    spendError: 'ads_read is missing',
    leads: [{ id: 'lead-1', campaignId: 'camp-1', qualified: true }],
    visits: [{ id: 'visit-1', dealId: 'deal-1', status: 'completed' }],
    deals: [{ id: 'deal-1', project: 'Oberai Gardens' }],
    payments: [{ id: 'pay-1', dealId: 'deal-1', amount: 50000, verified: true }],
    links: [],
  } });
  assert.equal(unread.collected, 50000);
  assert.equal(unread.costPerQualifiedLead, null);
  assert.equal(unread.roi, null);

  const db = createMemoryDb();
  await db.collection('ops_deals').insertOne({ id: 'deal-9', project: 'Keep', dealNumber: 'D-9' });
  await linkLeadToDeal(db as never, { leadId: 'lead-9', dealId: 'deal-9' }, 'admin-1');
  const deal = await db.collection('ops_deals').findOne({ id: 'deal-9' });
  assert.equal(deal?.project, 'Keep');
  assert.equal(deal?.leadId, undefined);

  await db.collection(GROWTH_CAPTURE_COLLECTION).insertOne({
    id: 'lead-9',
    source: 'meta_instant_form',
    externalId: 'ext-9',
    idempotencyKey: 'meta_instant_form:ext-9',
    campaignId: 'camp-9',
    name: '',
    phone: '',
    message: '',
    adId: '',
    formId: '',
    answers: {},
    status: 'captured',
    at: '2026-11-03T00:00:00.000Z',
    deletedAt: null,
  });
  await db.collection(DEMAND_PROFILES_COLLECTION).insertOne({
    id: 'profile-9',
    sourceEventId: 'lead-9',
    configuration: '2 BHK',
    location: 'Goregaon',
    possession: '',
    intent: 'buy',
    budgetMin: 1000000,
    budgetMax: 2000000,
    contactId: '',
    requirementId: '',
    answers: {},
    deletedAt: null,
    updatedAt: '2026-11-03T00:00:00.000Z',
  });
  const report = await buildRevenueReport(db as never, { rows: [{ campaignId: 'camp-9', spend: 4000, campaignName: 'Oberai' }], error: '' });
  const camp = report.reports.find((item) => item.campaignId === 'camp-9');
  assert.ok(camp);
  assert.equal(camp?.qualifiedLeads, 1);
  assert.equal(camp?.collected, 0);
  assert.equal(camp?.spend, 4000);

  console.log('os-phase7-revenue: ok');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
