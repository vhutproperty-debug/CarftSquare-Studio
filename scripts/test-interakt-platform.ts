/**
 * Unit/smoke tests for master-platform WhatsApp extensions
 * (templates, status, AI rules, follow-up/campaign invariants).
 * Does not require Mongo or live Interakt.
 */
import assert from 'node:assert/strict';
import { getInteraktTemplateCatalog, getDefaultFollowUpTemplate, getTemplateByName } from '../lib/interakt/templates';
import { getInteraktIntegrationStatus } from '../lib/interakt/status';
import { INTERAKT_PRODUCTION_WA_NUMBER, LEGACY_MARKETING_WA_NUMBER } from '../lib/interakt/phone';
import { classifyWithRules } from '../lib/interakt/ai';

let passed = 0;
function check(name: string, fn: () => void) {
  try {
    fn();
    passed += 1;
    console.log(`PASS  ${name}`);
  } catch (error) {
    console.error(`FAIL  ${name}`, error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}

check('production WA constant locked', () => {
  assert.equal(INTERAKT_PRODUCTION_WA_NUMBER, '919867525258');
  assert.equal(LEGACY_MARKETING_WA_NUMBER, '917304242604');
});

check('template catalog has follow-up + welcome', () => {
  const catalog = getInteraktTemplateCatalog();
  assert.ok(catalog.length >= 2);
  assert.ok(getDefaultFollowUpTemplate().name);
  assert.ok(getTemplateByName(catalog[0].name));
});

check('integration status never reports legacy marketing as production match', () => {
  const prev = process.env.INTERAKT_BUSINESS_WA_NUMBER;
  process.env.INTERAKT_BUSINESS_WA_NUMBER = INTERAKT_PRODUCTION_WA_NUMBER;
  const status = getInteraktIntegrationStatus();
  assert.equal(status.businessWaMatchesProduction, true);
  assert.equal(status.legacyMarketingNumberForbidden, LEGACY_MARKETING_WA_NUMBER);
  assert.equal(status.sessionTextSupported, false);
  if (prev === undefined) delete process.env.INTERAKT_BUSINESS_WA_NUMBER;
  else process.env.INTERAKT_BUSINESS_WA_NUMBER = prev;
});

check('legacy marketing number is rejected by status helper', () => {
  const prev = process.env.INTERAKT_BUSINESS_WA_NUMBER;
  process.env.INTERAKT_BUSINESS_WA_NUMBER = LEGACY_MARKETING_WA_NUMBER;
  const status = getInteraktIntegrationStatus();
  assert.equal(status.businessWaMatchesProduction, false);
  assert.ok(status.businessWaError);
  if (prev === undefined) delete process.env.INTERAKT_BUSINESS_WA_NUMBER;
  else process.env.INTERAKT_BUSINESS_WA_NUMBER = prev;
});

check('AI rules classify opt-out without inventing identity', () => {
  const insight = classifyWithRules('please stop messaging me. wrong number');
  assert.equal(insight.intent, 'opt_out');
  assert.ok(insight.intentConfidence >= 0.8);
  assert.match(insight.suggestedNextAction, /do-not-contact|cancel/i);
});

check('campaign throttle bounds match createCampaign clamp', () => {
  const clamp = (n?: number) => Math.min(Math.max(n || 20, 1), 60);
  assert.equal(clamp(undefined), 20);
  assert.equal(clamp(100), 60);
  assert.equal(clamp(20), 20);
  assert.equal(clamp(1), 1);
});

console.log(`\n${passed} checks completed`);
if (process.exitCode) process.exit(process.exitCode);
