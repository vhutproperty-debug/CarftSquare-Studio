'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';

type Requirement = {
  id: string;
  bhk?: string;
  localities?: string[];
  budgetMin?: string;
  budgetMax?: string;
  clientName?: string;
};

export default function RequirementsDesk() {
  const [rows, setRows] = useState<Requirement[]>([]);
  const [bhk, setBhk] = useState('');
  const [localities, setLocalities] = useState('');
  const [budgetMin, setBudgetMin] = useState('');
  const [budgetMax, setBudgetMax] = useState('');
  const [clientName, setClientName] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const response = await fetch('/api/ops/requirements', { cache: 'no-store' });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error || 'Could not load requirements.');
      return;
    }
    setRows(data.requirements || []);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');
    const response = await fetch('/api/ops/requirements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bhk, localities, budgetMin, budgetMax, clientName }),
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error || 'Could not save.');
      return;
    }
    setBhk('');
    setLocalities('');
    setBudgetMin('');
    setBudgetMax('');
    setClientName('');
    await load();
  }

  return (
    <div className="space-y-4">
      <form onSubmit={onSubmit} className="grid gap-2 rounded-xl border border-slate-200 bg-white p-4 md:grid-cols-5">
        <input aria-label="BHK" value={bhk} onChange={(event) => setBhk(event.target.value)} placeholder="BHK" className="h-10 rounded-md border border-slate-200 px-3" />
        <input aria-label="Localities" value={localities} onChange={(event) => setLocalities(event.target.value)} placeholder="Localities" className="h-10 rounded-md border border-slate-200 px-3" />
        <input aria-label="Budget min" value={budgetMin} onChange={(event) => setBudgetMin(event.target.value)} placeholder="Budget min" className="h-10 rounded-md border border-slate-200 px-3" />
        <input aria-label="Budget max" value={budgetMax} onChange={(event) => setBudgetMax(event.target.value)} placeholder="Budget max" className="h-10 rounded-md border border-slate-200 px-3" />
        <input aria-label="Client name" value={clientName} onChange={(event) => setClientName(event.target.value)} placeholder="Client name" className="h-10 rounded-md border border-slate-200 px-3" />
        <button type="submit" className="h-10 rounded-md bg-orange-600 px-3 text-sm font-semibold text-white md:col-span-5 md:w-fit">Save requirement</button>
      </form>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <ul className="space-y-2">
        {rows.map((row) => (
          <li key={row.id} className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm">
            {(row.bhk ? `${row.bhk} BHK` : 'Requirement')}{row.localities?.length ? ` · ${row.localities.join(', ')}` : ''}
            {row.clientName ? ` · ${row.clientName}` : ''}
            {row.budgetMin || row.budgetMax ? ` · ${row.budgetMin || '—'} to ${row.budgetMax || '—'}` : ''}
          </li>
        ))}
        {!rows.length ? <li className="text-sm text-slate-500">No requirements yet.</li> : null}
      </ul>
    </div>
  );
}
