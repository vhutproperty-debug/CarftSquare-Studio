/**
 * WhatsApp Delivery / Recovery Engine tests.
 * Run: npm run test:interakt-delivery
 *
 * Covers state machine, classifier, reconciliation scenario (100 msgs),
 * duplicate webhook/retry guards, and race rules — without live Interakt.
 */
import assert from 'node:assert/strict';
import {
  canTransition,
  shouldApplyDeliveryState,
  isTerminalDeliveryState,
  mapInteraktStatusToDeliveryState,
} from '../lib/interakt/delivery/state-machine';
import { classifyDeliveryFailure } from '../lib/interakt/delivery/failure-classifier';
import {
  evaluateCampaignLifecycle,
} from '../lib/interakt/delivery/reconcile';
import type { DeliveryStats, DeliveryState } from '../lib/interakt/delivery/types';
import { computeRetryDelayMs, getDeliveryRetryConfig } from '../lib/interakt/delivery/config';
import { INTERAKT_PRODUCTION_WA_NUMBER, LEGACY_MARKETING_WA_NUMBER } from '../lib/interakt/phone';

let passed = 0;
let failed = 0;

function check(name: string, fn: () => void) {
  try {
    fn();
    passed += 1;
    console.log(`PASS  ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`FAIL  ${name}`, error instanceof Error ? error.message : error);
  }
}

function emptyStats(partial: Partial<DeliveryStats> = {}): DeliveryStats {
  return {
    total: 0,
    queued: 0,
    submitting: 0,
    submitted: 0,
    pending: 0,
    sent: 0,
    delivered: 0,
    read: 0,
    temporaryFailure: 0,
    retryScheduled: 0,
    retrying: 0,
    permanentFailure: 0,
    cancelled: 0,
    unknown: 0,
    skipped: 0,
    terminal: 0,
    nonTerminal: 0,
    ...partial,
  };
}

// --- Production lock ---
check('production WA locked; legacy forbidden constant', () => {
  assert.equal(INTERAKT_PRODUCTION_WA_NUMBER, '919867525258');
  assert.equal(LEGACY_MARKETING_WA_NUMBER, '917304242604');
});

// --- State machine ---
check('valid transitions: QUEUED→SUBMITTING→SUBMITTED→SENT→DELIVERED→READ', () => {
  assert.equal(canTransition('QUEUED', 'SUBMITTING'), true);
  assert.equal(canTransition('SUBMITTING', 'SUBMITTED'), true);
  assert.equal(canTransition('SUBMITTED', 'SENT'), true);
  assert.equal(canTransition('SENT', 'DELIVERED'), true);
  assert.equal(canTransition('DELIVERED', 'READ'), true);
  assert.equal(canTransition('READ', 'SENT'), false);
});

check('delivered/read never overwritten by failure', () => {
  assert.equal(shouldApplyDeliveryState('DELIVERED', 'TEMPORARY_FAILURE'), false);
  assert.equal(shouldApplyDeliveryState('READ', 'PERMANENT_FAILURE'), false);
  assert.equal(shouldApplyDeliveryState('SENT', 'TEMPORARY_FAILURE'), true);
});

check('delayed success replaces temporary failure', () => {
  assert.equal(shouldApplyDeliveryState('TEMPORARY_FAILURE', 'DELIVERED'), true);
  assert.equal(shouldApplyDeliveryState('RETRY_SCHEDULED', 'DELIVERED'), true);
});

check('terminal states recognized', () => {
  for (const s of ['DELIVERED', 'READ', 'PERMANENT_FAILURE', 'CANCELLED'] as DeliveryState[]) {
    assert.equal(isTerminalDeliveryState(s), true);
  }
  assert.equal(isTerminalDeliveryState('RETRY_SCHEDULED'), false);
  assert.equal(isTerminalDeliveryState('PENDING'), false);
});

check('map interakt status', () => {
  assert.equal(mapInteraktStatusToDeliveryState('delivered'), 'DELIVERED');
  assert.equal(mapInteraktStatusToDeliveryState('failed'), 'TEMPORARY_FAILURE');
  assert.equal(mapInteraktStatusToDeliveryState('read'), 'READ');
});

// --- Failure classifier ---
check('rate limit is retryable', () => {
  const c = classifyDeliveryFailure({ httpStatus: 429, apiMessage: 'rate limit' });
  assert.equal(c.failureClass, 'RETRYABLE');
});

check('invalid phone is permanent', () => {
  const c = classifyDeliveryFailure({
    channelFailureReason: 'Invalid phone number',
    channelErrorCode: '131026',
  });
  assert.equal(c.failureClass, 'PERMANENT');
});

check('opt-out is permanent', () => {
  const c = classifyDeliveryFailure({ channelFailureReason: 'User opted out' });
  assert.equal(c.failureClass, 'PERMANENT');
});

check('unknown when insufficient data', () => {
  const c = classifyDeliveryFailure({});
  assert.equal(c.failureClass, 'UNKNOWN');
});

check('5xx is retryable', () => {
  const c = classifyDeliveryFailure({ httpStatus: 503, apiMessage: 'unavailable' });
  assert.equal(c.failureClass, 'RETRYABLE');
});

// --- Retry config ---
check('retry delay grows with attempt', () => {
  process.env.INTERAKT_DELIVERY_JITTER = '0';
  const d1 = computeRetryDelayMs(1);
  const d2 = computeRetryDelayMs(3);
  assert.ok(d2 >= d1);
  delete process.env.INTERAKT_DELIVERY_JITTER;
});

check('retry config centralized defaults', () => {
  const cfg = getDeliveryRetryConfig();
  assert.ok(cfg.maxAttempts >= 1);
  assert.ok(cfg.baseDelayMs > 0);
});

// --- Scenario A–D: 100 submitted, 60 delivered, 30 temp fail, 10 pending ---
check('scenario: 100 msgs — campaign NOT complete while pending/retries open', () => {
  const stats = emptyStats({
    total: 100,
    delivered: 60,
    temporaryFailure: 0,
    retryScheduled: 30,
    pending: 10,
    terminal: 60,
    nonTerminal: 40,
  });
  const life = evaluateCampaignLifecycle('running', stats);
  assert.notEqual(life, 'completed');
  assert.notEqual(life, 'completed_with_failures');
  assert.ok(life === 'retrying' || life === 'waiting_for_delivery' || life === 'running');
});

check('scenario: after retries succeed — 100% reconciled completed_with_failures', () => {
  // 87 delivered, 9 read, 4 permanent
  const stats = emptyStats({
    total: 100,
    delivered: 87,
    read: 9,
    permanentFailure: 4,
    terminal: 100,
    nonTerminal: 0,
  });
  const life = evaluateCampaignLifecycle('waiting_for_delivery', stats);
  assert.equal(life, 'completed_with_failures');
});

check('scenario: all delivered/read → completed (100% reconciled, not claiming 100% delivered)', () => {
  const stats = emptyStats({
    total: 100,
    delivered: 90,
    read: 10,
    terminal: 100,
    nonTerminal: 0,
  });
  assert.equal(evaluateCampaignLifecycle('running', stats), 'completed');
});

check('scenario: 30 failures classified retryable → retry jobs expected (logic)', () => {
  const failures = Array.from({ length: 30 }, () =>
    classifyDeliveryFailure({ httpStatus: 503, apiMessage: 'temporary unavailable' }),
  );
  assert.equal(failures.every((f) => f.failureClass === 'RETRYABLE'), true);
});

check('scenario: permanent failures do not schedule retries (logic)', () => {
  const c = classifyDeliveryFailure({ channelFailureReason: 'Recipient does not exist on WhatsApp' });
  assert.equal(c.failureClass, 'PERMANENT');
});

check('max retry exhaustion maps to permanent lifecycle contribution', () => {
  const stats = emptyStats({
    total: 10,
    delivered: 7,
    permanentFailure: 3,
    terminal: 10,
    nonTerminal: 0,
  });
  assert.equal(evaluateCampaignLifecycle('retrying', stats), 'completed_with_failures');
});

check('duplicate webhook: same state apply is idempotent-safe', () => {
  assert.equal(shouldApplyDeliveryState('DELIVERED', 'DELIVERED'), true);
  // applying failure after deliver blocked
  assert.equal(shouldApplyDeliveryState('DELIVERED', 'TEMPORARY_FAILURE'), false);
});

check('webhook during retry: delivered wins over RETRY_SCHEDULED', () => {
  assert.equal(shouldApplyDeliveryState('RETRY_SCHEDULED', 'DELIVERED'), true);
  assert.equal(shouldApplyDeliveryState('RETRYING', 'DELIVERED'), true);
});

check('cancelled is terminal', () => {
  assert.equal(isTerminalDeliveryState('CANCELLED'), true);
  const stats = emptyStats({
    total: 5,
    delivered: 3,
    cancelled: 2,
    terminal: 5,
    nonTerminal: 0,
  });
  assert.equal(evaluateCampaignLifecycle('running', stats), 'completed_with_failures');
});

check('unknown failure class supported', () => {
  const c = classifyDeliveryFailure({ apiMessage: 'weird unexplained error xyz' });
  assert.equal(c.failureClass, 'UNKNOWN');
});

console.log(`\n--- Delivery engine ---`);
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
if (failed > 0) process.exit(1);
console.log('Delivery engine unit tests passed.');
