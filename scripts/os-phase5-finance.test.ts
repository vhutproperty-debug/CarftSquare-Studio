/**
 * Phase 5 payments ledger. Commission is collected only after a verified payment.
 * Run: npx tsx scripts/os-phase5-finance.test.ts
 */
import assert from 'node:assert/strict';
import { canMarkCommissionCollected, profitability, verifiedCollected } from '../lib/ops/finance/ledger';
import { financeSnapshot, recordExpense, recordPayment, verifyPayment } from '../lib/ops/finance/store';
import { createMemoryDb } from './lib/memory-db';

async function main() {
  const open = [{ id: 'p1', dealId: 'deal-1', amount: 50000, verified: false }];
  assert.equal(canMarkCommissionCollected(open, 'deal-1', 50000), false);
  assert.equal(verifiedCollected(open, 'deal-1'), 0);
  const closed = [{ id: 'p1', dealId: 'deal-1', amount: 50000, verified: true }];
  assert.equal(canMarkCommissionCollected(closed, 'deal-1', 50000), true);
  assert.equal(canMarkCommissionCollected(closed, 'deal-1', 60000), false);

  const books = profitability({
    expected: 80000,
    payments: [
      { id: 'p1', dealId: 'deal-1', amount: 50000, verified: true },
      { id: 'p2', dealId: 'deal-1', amount: 20000, verified: false },
    ],
    expenses: [{ id: 'e1', amount: 10000 }],
  });
  assert.equal(books.collected, 50000);
  assert.equal(books.profit, 40000);

  const db = createMemoryDb();
  const payment = await recordPayment(db as never, { dealId: 'deal-1', amount: 50000, verified: true }, 'sales-1', false);
  assert.equal(payment.verified, false);
  const snapshot = await financeSnapshot(db as never, 50000);
  assert.equal(snapshot.collected, 0);
  assert.equal(canMarkCommissionCollected(snapshot.payments, 'deal-1', 50000), false);
  const verified = await verifyPayment(db as never, payment.id, 'super-1');
  assert.equal(verified?.verified, true);
  await recordExpense(db as never, { amount: 8000, category: 'travel' }, 'admin-1');
  const after = await financeSnapshot(db as never, 50000);
  assert.equal(after.collected, 50000);
  assert.equal(after.profit, 42000);
  assert.equal(canMarkCommissionCollected(after.payments, 'deal-1', 50000), true);

  console.log('os-phase5-finance: ok');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
