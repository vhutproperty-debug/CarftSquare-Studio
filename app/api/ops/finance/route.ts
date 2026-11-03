import { NextResponse } from 'next/server';
import { authResultToResponse } from '@/lib/auth/rbac/guard';
import { requireOpsViewAccess } from '@/lib/ops/auth';
import { forbidUnlessOps, forbidUnlessPhase, releaseList } from '@/lib/ops/os/guard';
import { canOps, seesAllRecords } from '@/lib/ops/os/permissions';
import { profitability } from '@/lib/ops/finance/ledger';
import { financeSnapshot, getFinanceDb, recordExpense, recordPayment, verifyPayment } from '@/lib/ops/finance/store';
import { listRevenueRecords } from '@/lib/ops/revenue/store';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const closed = forbidUnlessPhase(5);
  if (closed) return closed;
  const auth = await requireOpsViewAccess(request);
  const denied = authResultToResponse(auth);
  if (denied) return denied;
  const blocked = forbidUnlessOps(auth.admin, 'see_internal_brokerage');
  if (blocked) return blocked;
  const db = await getFinanceDb();
  const revenue = await listRevenueRecords(db);
  const expected = revenue.reduce((sum, row) => sum + (row.expectedAmount || 0), 0);
  const snapshot = await financeSnapshot(db, expected);
  const payments = releaseList(auth.admin, snapshot.payments, 'deal');
  const expenseRows = releaseList(auth.admin, snapshot.expenseRows, 'deal');
  const books = seesAllRecords(auth.admin)
    ? { expected: snapshot.expected, collected: snapshot.collected, expenses: snapshot.expenses, profit: snapshot.profit }
    : profitability({ expected: 0, payments, expenses: expenseRows });
  return NextResponse.json({ ...books, payments, expenseRows });
}

export async function POST(request: Request) {
  const closed = forbidUnlessPhase(5);
  if (closed) return closed;
  const auth = await requireOpsViewAccess(request);
  const denied = authResultToResponse(auth);
  if (denied) return denied;
  const blocked = forbidUnlessOps(auth.admin, 'see_internal_brokerage');
  if (blocked) return blocked;
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: 'Finance payload is required.' }, { status: 400 });
  const db = await getFinanceDb();
  try {
    if (body.action === 'verify') {
      if (!canOps(auth.admin, 'edit')) {
        return NextResponse.json({ error: 'Only a super admin can verify a payment.' }, { status: 403 });
      }
      const payment = await verifyPayment(db, String(body.id || ''), auth.admin.id);
      if (!payment) return NextResponse.json({ error: 'Payment not found.' }, { status: 404 });
      return NextResponse.json({ payment });
    }
    if (body.kind === 'expense') {
      if (!canOps(auth.admin, 'fill_empty') && !canOps(auth.admin, 'edit')) {
        return NextResponse.json({ error: 'You do not have permission to record an expense.' }, { status: 403 });
      }
      const expense = await recordExpense(db, {
        amount: Number(body.amount),
        category: String(body.category || ''),
        note: String(body.note || ''),
        dealId: String(body.dealId || ''),
      }, auth.admin.id);
      return NextResponse.json({ expense }, { status: 201 });
    }
    const payment = await recordPayment(db, {
      dealId: String(body.dealId || ''),
      amount: Number(body.amount),
      note: String(body.note || ''),
      verified: body.verified === true,
    }, auth.admin.id, canOps(auth.admin, 'edit'));
    return NextResponse.json({ payment, collected: payment.verified }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to save.' }, { status: 400 });
  }
}
