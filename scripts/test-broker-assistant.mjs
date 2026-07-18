/**
 * Phase-1 NL parser smoke tests (no DB).
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

// Load via tsx-compatible dynamic import path used by test:brokers pattern
const { parseNaturalLanguageQuery, mergeAssistantState } = await import(
  '../lib/ops/brokers/assistant/nl-parser.ts'
);

const q1 = parseNaturalLanguageQuery('Show me 2 BHK rentals in Goregaon West below 65000', [
  'Oberoi Sky City',
]);
assert.equal(q1.delta.bhk, '2');
assert.equal(q1.delta.transactionType, 'RENT');
assert.equal(q1.delta.maxRent, 65000);
assert.ok(q1.delta.project || q1.delta.search);

const q2 = parseNaturalLanguageQuery("Search for 'negotiable'");
assert.equal(q2.delta.messageKeyword, 'negotiable');

const q3 = parseNaturalLanguageQuery('only furnished');
assert.equal(q3.delta.furnishing, 'FURNISHED');

const merged = mergeAssistantState(
  { bhk: '2', project: 'Goregaon West', transactionType: 'RENT' },
  q3.delta,
);
assert.equal(merged.bhk, '2');
assert.equal(merged.furnishing, 'FURNISHED');

const cleared = mergeAssistantState(merged, {}, true);
assert.equal(cleared.bhk, undefined);

const q4 = parseNaturalLanguageQuery('Any inventory posted yesterday?');
assert.equal(q4.delta.postedSince, 'yesterday');

console.log('assistant parser ok');
