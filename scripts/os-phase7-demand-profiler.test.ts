/**
 * Phase 7 demand profiler. Field mapping and rule-based inventory match.
 * Run: npx tsx scripts/os-phase7-demand-profiler.test.ts
 */
import assert from 'node:assert/strict';
import { mapLeadAnswers, matchInventory, parseBudget } from '../lib/ops/growth/demand/profile';
import { saveDemandProfile } from '../lib/ops/growth/demand/store';
import { saveDeveloperProject } from '../lib/ops/projects/store';
import { createMemoryDb } from './lib/memory-db';

async function main() {
  const budget = parseBudget('1-1.5 Cr');
  assert.equal(budget.min, 10000000);
  assert.equal(budget.max, 15000000);
  const mapped = mapLeadAnswers({
    what_is_your_budget: '80 lakh',
    bhk: '3 bhk',
    preferred_location: 'Goregaon',
    possession_timeline: 'Dec 2027',
    buy_or_rent: 'I want to buy',
  });
  assert.equal(mapped.configuration, '3 BHK');
  assert.equal(mapped.location, 'Goregaon');
  assert.equal(mapped.intent, 'buy');
  assert.equal(mapped.budgetMin, 8000000);

  const matches = matchInventory(mapped, [
    { id: 'a', name: 'Oberai', locality: 'Goregaon', configuration: '3 BHK', possession: 'Dec 2027', intent: 'buy', budgetMin: 7000000, budgetMax: 9000000 },
    { id: 'b', name: 'Rent', locality: 'Goregaon', configuration: '3 BHK', possession: 'Ready', intent: 'rent', budgetMin: 7000000, budgetMax: 9000000 },
    { id: 'c', name: 'Andheri', locality: 'Andheri', configuration: '3 BHK', possession: 'Dec 2027', intent: 'buy', budgetMin: 7000000, budgetMax: 9000000 },
  ]);
  assert.deepEqual(matches.map((row) => row.id), ['a']);
  assert.ok(matches[0].reasons.some((reason) => reason.includes('Budget')));

  const db = createMemoryDb();
  await db.collection('contacts').insertOne({ id: 'contact-1', name: 'Rahul', phones: ['9811111111'] });
  await saveDeveloperProject(db as never, {
    slug: 'oberai',
    name: 'Oberai Gardens',
    patch: { locality: 'Goregaon', channelPartnerStatus: 'empanelled', status: 'ready', configLabel: '3 BHK', possession: 'Dec 2027', priceMinCrore: 0.85 },
  }, 'sales-1');
  const saved = await saveDemandProfile(db as never, { answers: mappedToAnswers(mapped), contactId: 'contact-1' }, 'sales-1');
  assert.equal(saved.contactUpdated, false);
  assert.equal(saved.profile.contactId, 'contact-1');
  assert.ok(saved.profile.requirementId);
  const contact = await db.collection('contacts').findOne({ id: 'contact-1' });
  assert.equal(contact?.name, 'Rahul');
  assert.deepEqual(contact?.phones, ['9811111111']);

  console.log('os-phase7-demand-profiler: ok');
}

function mappedToAnswers(fields: { configuration: string; location: string; possession: string; intent: string; budgetMin: number | null }): Record<string, string> {
  return {
    bhk: fields.configuration,
    location: fields.location,
    possession: fields.possession,
    intent: fields.intent,
    budget: fields.budgetMin ? `${fields.budgetMin / 100000} lakh` : '',
  };
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
