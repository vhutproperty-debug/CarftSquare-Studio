/**
 * Phase 1 duplicate review and agreement terms.
 * Run: npx tsx scripts/os-phase1-workspace.test.ts
 */
import assert from 'node:assert/strict';
import { CONTACTS_COLLECTION } from '../lib/ops/contacts/types';
import { applyReviewDecision, findDuplicateGroups } from '../lib/ops/workspace/duplicates';
import {
  AGREEMENT_TERMS_COLLECTION,
  DUPLICATE_REVIEWS_COLLECTION,
  listAgreementTerms,
  listDuplicateReviews,
  queueDuplicateReviews,
  resolveDuplicateReview,
  saveAgreementTerms,
} from '../lib/ops/workspace/store';
import { createMemoryDb } from './lib/memory-db';

async function main() {
  const groups = findDuplicateGroups([
    { id: 'a', phones: ['9811111111'] },
    { id: 'b', phones: ['9811111111', '9822222222'] },
    { id: 'c', phones: ['9833333333'] },
  ]);
  assert.equal(groups.length, 1);
  assert.deepEqual(groups[0].contactIds, ['a', 'b']);

  const db = createMemoryDb();
  await db.collection(CONTACTS_COLLECTION).insertOne({ id: 'a', phones: ['9811111111'], name: 'Asha' });
  await db.collection(CONTACTS_COLLECTION).insertOne({ id: 'b', phones: ['9811111111'], name: 'Asha Shah' });
  const queued = await queueDuplicateReviews(db as never, 'exec-1');
  assert.equal(queued.created, 1);
  const again = await queueDuplicateReviews(db as never, 'exec-1');
  assert.equal(again.created, 0);
  const open = await listDuplicateReviews(db as never);
  assert.equal(open[0].status, 'open');
  const contactsBefore = await db.collection(CONTACTS_COLLECTION).countDocuments();
  const resolved = await resolveDuplicateReview(db as never, open[0].id, 'keep_both', { id: 'exec-1' });
  assert.equal(resolved?.decision, 'keep_both');
  assert.equal(resolved?.status, 'resolved');
  assert.equal(await db.collection(CONTACTS_COLLECTION).countDocuments(), contactsBefore);
  const names = (await db.collection(CONTACTS_COLLECTION).find({}).toArray()).map((row) => row.name).sort();
  assert.deepEqual(names, ['Asha', 'Asha Shah']);

  assert.throws(() => applyReviewDecision(open[0], 'merge' as 'keep_both', 'exec-1'));

  const terms = await saveAgreementTerms(db as never, {
    agreementId: 'agr-1',
    rent: '85000',
    deposit: '300000',
    lockInMonths: 6,
    noticeDays: 30,
  }, 'exec-1');
  assert.equal(terms.lockInMonths, 6);
  assert.equal(terms.noticeDays, 30);
  const updated = await saveAgreementTerms(db as never, { agreementId: 'agr-1', rent: '90000' }, 'exec-1');
  assert.equal(updated.rent, '90000');
  assert.equal(updated.deposit, '300000');
  assert.equal(await db.collection(AGREEMENT_TERMS_COLLECTION).countDocuments(), 1);
  const listed = await listAgreementTerms(db as never);
  assert.equal(listed.length, 1);
  assert.equal(await db.collection(DUPLICATE_REVIEWS_COLLECTION).countDocuments(), 1);

  console.log('os-phase1-workspace: ok');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
