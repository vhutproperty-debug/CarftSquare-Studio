'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';

type Payment = { id: string; dealId: string; amount: number; verified: boolean; note?: string };
type Expense = { id: string; amount: number; category: string; note?: string };
type Snapshot = { expected: number; collected: number; profit: number; payments: Payment[]; expenseRows: Expense[] };

export default function FinanceDesk() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [dealId, setDealId] = useState('');
  const [amount, setAmount] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    const response = await fetch('/api/ops/finance', { cache: 'no-store' });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error || 'Could not load finance.');
      return;
    }
    setSnapshot(data);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function addPayment(event: FormEvent) {
    event.preventDefault();
    setError('');
    setMessage('');
    const response = await fetch('/api/ops/finance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: 'payment', dealId, amount: Number(amount) }),
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error || 'Could not record the payment.');
      return;
    }
    setMessage(data.payment?.verified ? 'Payment recorded as verified.' : 'Payment recorded. It does not count as collected until a super admin verifies it.');
    setDealId('');
    setAmount('');
    await load();
  }

  async function addExpense(event: FormEvent) {
    event.preventDefault();
    setError('');
    const response = await fetch('/api/ops/finance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: 'expense', amount: Number(expenseAmount), category: 'general' }),
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error || 'Could not record the expense.');
      return;
    }
    setExpenseAmount('');
    await load();
  }

  async function verify(id: string) {
    const response = await fetch('/api/ops/finance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'verify', id }),
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error || 'Could not verify the payment.');
      return;
    }
    setMessage('Payment verified. Commission can count as collected only after this.');
    await load();
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs font-bold uppercase text-slate-500">Expected</p><p className="text-2xl font-black">{snapshot?.expected ?? '—'}</p></div>
        <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs font-bold uppercase text-slate-500">Verified collected</p><p className="text-2xl font-black">{snapshot?.collected ?? '—'}</p></div>
        <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs font-bold uppercase text-slate-500">Profit</p><p className="text-2xl font-black">{snapshot?.profit ?? '—'}</p></div>
      </div>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
      <form onSubmit={addPayment} className="flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-white p-4">
        <input aria-label="Deal id" value={dealId} onChange={(event) => setDealId(event.target.value)} required placeholder="Deal id" className="h-10 rounded-md border border-slate-200 px-3" />
        <input aria-label="Payment amount" value={amount} onChange={(event) => setAmount(event.target.value)} required placeholder="Amount" className="h-10 rounded-md border border-slate-200 px-3" />
        <button type="submit" className="rounded-md bg-orange-600 px-3 text-sm font-semibold text-white">Record payment</button>
      </form>
      <form onSubmit={addExpense} className="flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-white p-4">
        <input aria-label="Expense amount" value={expenseAmount} onChange={(event) => setExpenseAmount(event.target.value)} required placeholder="Expense amount" className="h-10 rounded-md border border-slate-200 px-3" />
        <button type="submit" className="rounded-md border border-slate-300 px-3 text-sm font-semibold">Record expense</button>
      </form>
      <ul className="space-y-2">
        {(snapshot?.payments || []).map((payment) => (
          <li key={payment.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm">
            <span>{payment.dealId} · {payment.amount} · {payment.verified ? 'verified' : 'unverified'}</span>
            {!payment.verified ? <button type="button" className="rounded border border-slate-300 px-2 py-1" onClick={() => verify(payment.id)}>Verify</button> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
