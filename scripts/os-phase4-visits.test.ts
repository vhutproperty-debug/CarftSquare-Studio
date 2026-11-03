/**
 * Phase 4 site visits. Deal documents are not deleted.
 * Run: npx tsx scripts/os-phase4-visits.test.ts
 */
import assert from 'node:assert/strict';
import { listSiteVisits, scheduleSiteVisit, SITE_VISITS_COLLECTION, updateSiteVisitStatus } from '../lib/ops/visits/store';
import { createMemoryDb } from './lib/memory-db';

async function main() {
  const db = createMemoryDb();
  await db.collection('ops_deals').insertOne({ id: 'deal-1', stage: 'NEGOTIATION' });
  const visit = await scheduleSiteVisit(db as never, { dealId: 'deal-1', scheduledAt: '2026-11-04T10:00' }, 'sales-1');
  assert.equal(visit.status, 'scheduled');
  const done = await updateSiteVisitStatus(db as never, visit.id, 'completed', 'sales-1');
  assert.equal(done?.status, 'completed');
  const cancelled = await scheduleSiteVisit(db as never, { dealId: 'deal-1', scheduledAt: '2026-11-05T10:00' }, 'sales-1');
  await updateSiteVisitStatus(db as never, cancelled.id, 'cancelled', 'sales-1');
  const rows = await listSiteVisits(db as never);
  assert.equal(rows.length, 2);
  assert.equal(await db.collection(SITE_VISITS_COLLECTION).countDocuments(), 2);
  const deal = await db.collection('ops_deals').findOne({ id: 'deal-1' });
  assert.equal(deal?.stage, 'NEGOTIATION');
  console.log('os-phase4-visits: ok');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
