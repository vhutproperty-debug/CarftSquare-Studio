/**
 * Phase 7 follow-up. Bulk sends need approval. Restricted WABA cannot send.
 * Run: npx tsx scripts/os-phase7-followup.test.ts
 */
import assert from 'node:assert/strict';
import { OPS_FOLLOW_UP_JOBS_COLLECTION } from '../lib/ops/followups/store';
import {
  approveFollowUpBatch,
  recordFollowUpDelivery,
  scheduleFollowUp,
  sendFollowUpBatch,
  syncApprovedTemplates,
} from '../lib/ops/growth/followup/store';
import { createMemoryDb } from './lib/memory-db';

async function main() {
  const db = createMemoryDb();
  const synced = await syncApprovedTemplates(db as never, [
    { name: 'lead_followup_day1', language: 'en', status: 'APPROVED', id: 't1' },
    { name: 'draft_only', language: 'en', status: 'PENDING' },
  ]);
  assert.equal(synced.approved, 1);
  assert.equal(synced.templates.length, 1);

  const bulk = await scheduleFollowUp(db as never, {
    templateName: 'lead_followup_day1',
    scheduledFor: '2026-11-04T10:00:00.000Z',
    recipients: [
      { phone: '9811111111', leadId: 'lead-1' },
      { phone: '9822222222', leadId: 'lead-2' },
    ],
  }, 'sales-1');
  assert.equal(bulk.status, 'pending_approval');
  assert.equal(bulk.bulk, true);
  await assert.rejects(() => sendFollowUpBatch(db as never, bulk.id, false, { id: 'sales-1' }), /approval/);
  assert.equal(await db.collection(OPS_FOLLOW_UP_JOBS_COLLECTION).countDocuments({}), 0);
  await assert.rejects(() => approveFollowUpBatch(db as never, bulk.id, false, { id: 'sales-1' }), /super admin/);
  const approved = await approveFollowUpBatch(db as never, bulk.id, true, { id: 'super-1', email: 'super@example.com' });
  assert.equal(approved.status, 'approved');
  assert.equal(await db.collection(OPS_FOLLOW_UP_JOBS_COLLECTION).countDocuments({}), 0);

  await assert.rejects(() => sendFollowUpBatch(db as never, bulk.id, true, { id: 'super-1' }), /WABA is restricted/);
  const blocked = await db.collection('ops_growth_followup_batches').findOne({ id: bulk.id });
  assert.equal(blocked?.status, 'blocked');
  assert.equal(await db.collection(OPS_FOLLOW_UP_JOBS_COLLECTION).countDocuments({}), 0);

  const single = await scheduleFollowUp(db as never, {
    templateName: 'lead_followup_day1',
    scheduledFor: '2026-11-04T11:00:00.000Z',
    recipients: [{ phone: '9833333333', leadId: 'lead-3' }],
  }, 'sales-1');
  assert.equal(single.bulk, false);
  const queued = await sendFollowUpBatch(db as never, single.id, false, { id: 'sales-1', email: 'sales@example.com' });
  assert.equal(queued.status, 'queued');
  assert.equal(await db.collection(OPS_FOLLOW_UP_JOBS_COLLECTION).countDocuments({}), 1);
  const tracked = await recordFollowUpDelivery(db as never, single.id, { phone: '9833333333', status: 'replied' });
  assert.equal(tracked?.deliveries[0].status, 'replied');

  console.log('os-phase7-followup: ok');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
