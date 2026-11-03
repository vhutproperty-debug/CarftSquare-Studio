/**
 * Phase 7 lead intelligence. Rule scores and duplicate review without a merge.
 * Run: npx tsx scripts/os-phase7-lead-intelligence.test.ts
 */
import assert from 'node:assert/strict';
import { DEFAULT_SCORE_WEIGHTS, scoreEngagement, scoreQualification } from '../lib/ops/growth/intelligence/scores';
import { queueLeadDuplicate, saveScoreWeights } from '../lib/ops/growth/intelligence/store';
import { createMemoryDb } from './lib/memory-db';

async function main() {
  const engagement = scoreEngagement({ source: 'meta_instant_form', replied: false, touches: 1 });
  assert.equal(engagement.breakdown.length, 3);
  assert.equal(engagement.breakdown.find((rule) => rule.id === 'metaForm')?.applied, true);
  assert.equal(engagement.breakdown.find((rule) => rule.id === 'whatsappReply')?.points, 0);
  assert.equal(engagement.score, DEFAULT_SCORE_WEIGHTS.engagement.metaForm);

  const qualified = scoreQualification({
    budget: true,
    configuration: true,
    location: true,
    possession: true,
    intent: true,
    inventoryMatch: false,
    openDuplicate: true,
  });
  assert.ok(qualified.breakdown.every((rule) => rule.label && typeof rule.weight === 'number'));
  const penalty = qualified.breakdown.find((rule) => rule.id === 'duplicatePenalty');
  assert.equal(penalty?.points, -DEFAULT_SCORE_WEIGHTS.qualification.duplicatePenalty);
  assert.ok(qualified.score < 100);

  const heavier = scoreEngagement({ source: 'meta_instant_form', replied: false, touches: 1 }, {
    ...DEFAULT_SCORE_WEIGHTS,
    engagement: { ...DEFAULT_SCORE_WEIGHTS.engagement, metaForm: 10 },
  });
  assert.equal(heavier.score, 10);

  const db = createMemoryDb();
  await db.collection('contacts').insertOne({ id: 'contact-1', name: 'Rahul', phones: ['9811111111'] });
  await db.collection('contacts').insertOne({ id: 'contact-2', name: 'Meera', phones: ['9811111111'] });
  const queued = await queueLeadDuplicate(db as never, { phone: '9811111111', leadId: 'lead-1', actorId: 'sales-1' });
  assert.equal(queued.created, true);
  assert.equal(queued.merged, false);
  const again = await queueLeadDuplicate(db as never, { phone: '9811111111', leadId: 'lead-2', actorId: 'sales-1' });
  assert.equal(again.created, false);
  assert.equal(again.merged, false);
  const reviews = await db.collection('contact_duplicate_reviews').find({}).toArray();
  assert.equal(reviews.length, 1);
  assert.equal(reviews[0].status, 'open');
  assert.deepEqual(reviews[0].leadIds, ['lead-1', 'lead-2']);
  const contacts = await db.collection('contacts').find({}).toArray();
  assert.equal(contacts.length, 2);
  assert.equal(contacts.find((row) => row.id === 'contact-1')?.name, 'Rahul');

  const saved = await saveScoreWeights(db as never, { engagement: { metaForm: 15, whatsappReply: 15, repeatTouch: 5 } }, { id: 'super-1' });
  assert.equal(saved.engagement.metaForm, 15);

  console.log('os-phase7-lead-intelligence: ok');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
