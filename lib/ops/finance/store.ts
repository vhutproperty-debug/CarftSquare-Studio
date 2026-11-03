import { v4 as uuidv4 } from 'uuid';
import type { Db } from 'mongodb';
// @ts-expect-error JS module without types
import { getDb } from '@/lib/mongodb';
import { stampCreate } from '@/lib/ops/os/records';
import { profitability, verifiedCollected, type LedgerExpense, type LedgerPayment } from '@/lib/ops/finance/ledger';

export const PAYMENTS_COLLECTION = 'ops_payments';
export const EXPENSES_COLLECTION = 'ops_expenses';

export type PaymentRecord = LedgerPayment & {
  note: string;
  verifiedAt: string | null;
  verifiedBy: string;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
};

export type ExpenseRecord = LedgerExpense & {
  category: string;
  note: string;
  dealId: string;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
};

let indexesReady = false;

async function ensureIndexes(db: Db): Promise<void> {
  if (indexesReady) return;
  await db.collection(PAYMENTS_COLLECTION).createIndex({ id: 1 }, { unique: true });
  await db.collection(PAYMENTS_COLLECTION).createIndex({ dealId: 1, verified: 1 });
  await db.collection(EXPENSES_COLLECTION).createIndex({ id: 1 }, { unique: true });
  indexesReady = true;
}

export async function getFinanceDb(): Promise<Db> {
  return getDb();
}

export async function listPayments(db: Db): Promise<PaymentRecord[]> {
  await ensureIndexes(db);
  const rows = await db.collection(PAYMENTS_COLLECTION).find({}).sort({ createdAt: -1 }).toArray();
  return (rows as unknown as PaymentRecord[]).filter((row) => !row.deletedAt);
}

export async function listExpenses(db: Db): Promise<ExpenseRecord[]> {
  await ensureIndexes(db);
  const rows = await db.collection(EXPENSES_COLLECTION).find({}).sort({ createdAt: -1 }).toArray();
  return (rows as unknown as ExpenseRecord[]).filter((row) => !row.deletedAt);
}

export async function recordPayment(
  db: Db,
  input: { dealId: string; amount: number; note?: string; verified?: boolean },
  actorId: string,
  allowVerified: boolean,
): Promise<PaymentRecord> {
  await ensureIndexes(db);
  if (!input.dealId.trim()) throw new Error('A deal id is required.');
  if (!(input.amount > 0)) throw new Error('Amount must be greater than zero.');
  const verified = Boolean(input.verified) && allowVerified;
  const doc: PaymentRecord = {
    id: uuidv4(),
    dealId: input.dealId.trim(),
    amount: input.amount,
    verified,
    note: input.note?.trim() || '',
    verifiedAt: verified ? new Date().toISOString() : null,
    verifiedBy: verified ? actorId : '',
    ...stampCreate({ id: actorId }),
  };
  await db.collection(PAYMENTS_COLLECTION).insertOne({ ...doc });
  return doc;
}

export async function verifyPayment(db: Db, id: string, actorId: string): Promise<PaymentRecord | null> {
  await ensureIndexes(db);
  const current = await db.collection(PAYMENTS_COLLECTION).findOne({ id }) as PaymentRecord | null;
  if (!current || current.deletedAt) return null;
  const next: PaymentRecord = {
    ...current,
    verified: true,
    verifiedAt: new Date().toISOString(),
    verifiedBy: actorId,
    updatedBy: actorId,
    updatedAt: new Date().toISOString(),
  };
  const stored = { ...next } as PaymentRecord & { _id?: unknown };
  delete stored._id;
  await db.collection(PAYMENTS_COLLECTION).updateOne({ id }, { $set: stored });
  return next;
}

export async function recordExpense(
  db: Db,
  input: { amount: number; category?: string; note?: string; dealId?: string },
  actorId: string,
): Promise<ExpenseRecord> {
  await ensureIndexes(db);
  if (!(input.amount > 0)) throw new Error('Amount must be greater than zero.');
  const doc: ExpenseRecord = {
    id: uuidv4(),
    amount: input.amount,
    category: input.category?.trim() || 'general',
    note: input.note?.trim() || '',
    dealId: input.dealId?.trim() || '',
    ...stampCreate({ id: actorId }),
  };
  await db.collection(EXPENSES_COLLECTION).insertOne({ ...doc });
  return doc;
}

export async function financeSnapshot(db: Db, expected: number) {
  const [payments, expenseRows] = await Promise.all([listPayments(db), listExpenses(db)]);
  return {
    ...profitability({ expected, payments, expenses: expenseRows }),
    payments,
    expenseRows,
    verifiedByDeal: (dealId: string) => verifiedCollected(payments, dealId),
  };
}

export async function verifiedCollectedForDeal(db: Db, dealId: string): Promise<number> {
  const payments = await listPayments(db);
  return verifiedCollected(payments, dealId);
}
