/**
 * Deterministic V2 unit checks (no Mongo required for core algorithms).
 * Run: node scripts/test-brokers-v2.mjs
 * For TS modules we shell out to tsx.
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(root, '..');

const script = `
import assert from 'node:assert/strict';
import { computeConfidenceBreakdown, scoreDedupeConfidence } from './lib/ops/brokers/confidence.ts';
import { decideReviewRouting } from './lib/ops/brokers/review.ts';
import { diffInventoryChanges } from './lib/ops/brokers/history.ts';
import { normalizeProjectNameWithMap, normalizeKey } from './lib/ops/brokers/normalize/project-aliases.ts';
import { buildDedupeKey } from './lib/ops/brokers/dedupe/dedupe-key.ts';
import { isResumableImportStatus, isTerminalImportStatus, normalizeImportStatusForUi } from './lib/ops/brokers/statuses.ts';
import { CONFIDENCE_WEIGHTS, REVIEW_CONFIG } from './lib/ops/brokers/config.ts';

// Config layer
assert.equal(Object.values(CONFIDENCE_WEIGHTS).reduce((a,b)=>a+b,0).toFixed(2), '1.00');
assert.ok(REVIEW_CONFIG.dedupeAutoMergeMin > REVIEW_CONFIG.dedupeReviewMax);

// Alias resolution (map)
const map = new Map([
  [normalizeKey('oberoi sky city'), 'Oberoi Sky City'],
  [normalizeKey('skycity'), 'Oberoi Sky City'],
]);
const mapped = normalizeProjectNameWithMap('SkyCity tower A', map);
assert.equal(mapped.projectMapped, true);
assert.equal(mapped.projectName, 'Oberoi Sky City');
const unknown = normalizeProjectNameWithMap('Random Heights', map);
assert.equal(unknown.projectMapped, false);

// Confidence
const conf = computeConfidenceBreakdown({
  parseStatus: 'PARSED',
  rawMessage: 'Oberoi Sky City 3 BHK rent 85k semi furnished available immediate tower A flat 1203',
  hasTimestamp: true,
  hasSender: true,
  extracted: {
    projectName: 'Oberoi Sky City',
    projectMapped: true,
    configuration: '3 BHK',
    bhk: 3,
    rent: 85000,
    rentText: '85k',
    transactionType: 'RENT',
    furnishing: 'SEMI_FURNISHED',
    unitNumber: '1203',
    tower: 'A',
  },
  brokerPhone: '9876543210',
});
assert.ok(conf.overallConfidence >= 70, 'expected high confidence, got ' + conf.overallConfidence);

// Auto-index workflow — mid dedupe / unknown project no longer block inventory
const route = decideReviewRouting({
  confidence: conf,
  dedupeConfidence: 55,
  existing: { id: 'x', rent: 85000, bhk: 3 } as any,
  projectMapped: true,
});
assert.equal(route.action, 'auto_merge');

// Auto create high confidence
const createRoute = decideReviewRouting({
  confidence: conf,
  dedupeConfidence: 100,
  existing: null,
  projectMapped: true,
});
assert.equal(createRoute.action, 'auto_create');

// Low confidence (badge band) still auto-indexes
const lowBand = decideReviewRouting({
  confidence: { ...conf, overallConfidence: 40 },
  dedupeConfidence: 100,
  existing: null,
  projectMapped: false,
});
assert.equal(lowBand.action, 'auto_create');

// Very low confidence → optional review queue
const veryLow = decideReviewRouting({
  confidence: { ...conf, overallConfidence: 20 },
  dedupeConfidence: 100,
  existing: null,
  projectMapped: true,
});
assert.equal(veryLow.action, 'review');
assert.ok(veryLow.reasons.includes('low_confidence'));

// Parse failure → review
const parseFail = decideReviewRouting({
  confidence: conf,
  dedupeConfidence: 100,
  existing: null,
  projectMapped: true,
  malformed: true,
});
assert.equal(parseFail.action, 'review');
assert.ok(parseFail.reasons.includes('malformed_listing'));

// Change history diff
const history = diffInventoryChanges(
  {
    id: 'inv1',
    rent: 80000,
    furnishing: 'UNFURNISHED',
    status: 'ACTIVE',
  } as any,
  { rent: 85000, furnishing: 'SEMI_FURNISHED' },
  { sourceMessageId: 'm1', importBatchId: 'b1' },
);
assert.ok(history.some((h) => h.fieldChanged === 'rent'));
assert.ok(history.some((h) => h.fieldChanged === 'furnishing'));

// Dedupe strong key
const k1 = buildDedupeKey({
  projectNormalized: 'oberoi sky city',
  transactionType: 'RENT',
  tower: 'A',
  unitNumber: '1203',
});
const k2 = buildDedupeKey({
  projectNormalized: 'oberoi sky city',
  transactionType: 'RENT',
  tower: 'A',
  wing: '2',
  unitNumber: '1203',
});
assert.equal(k1, k2);

// Lifecycle helpers
assert.equal(isTerminalImportStatus('PARTIAL'), true);
assert.equal(isResumableImportStatus('FAILED'), true);
assert.equal(normalizeImportStatusForUi('COMPLETED_WITH_ERRORS'), 'PARTIAL');

// Dedupe confidence conflict
const d = scoreDedupeConfidence({
  dedupeKey: 'u|x|rent|a|1203',
  existing: { rent: 100000, bhk: 3 },
  proposed: { rent: 70000, bhk: 3 },
});
assert.ok(d < 80);

console.log('All brokers V2 checks passed.');
`;

const result = spawnSync(
  'npx',
  ['--yes', 'tsx', '-e', script],
  { cwd: repo, encoding: 'utf8', shell: true },
);

process.stdout.write(result.stdout || '');
process.stderr.write(result.stderr || '');
process.exit(result.status ?? 1);
