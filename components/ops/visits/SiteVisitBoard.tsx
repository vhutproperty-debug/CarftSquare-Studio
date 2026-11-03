'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';

type Visit = { id: string; dealId: string; scheduledAt: string; status: string; notes?: string };

export default function SiteVisitBoard() {
  const [visits, setVisits] = useState<Visit[]>([]);
  const [dealId, setDealId] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const response = await fetch('/api/ops/site-visits', { cache: 'no-store' });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error || 'Could not load visits.');
      return;
    }
    setVisits(data.visits || []);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');
    const response = await fetch('/api/ops/site-visits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dealId, scheduledAt }),
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error || 'Could not schedule the visit.');
      return;
    }
    setDealId('');
    setScheduledAt('');
    await load();
  }

  async function setStatus(id: string, status: string) {
    const response = await fetch('/api/ops/site-visits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'status', id, status }),
    });
    if (!response.ok) {
      const data = await response.json();
      setError(data.error || 'Could not update the visit.');
      return;
    }
    await load();
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">Visits sit beside the deal pipeline. Cancelling a visit keeps the row and does not change the deal record.</p>
      <form onSubmit={onSubmit} className="flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-white p-4">
        <input aria-label="Deal id" value={dealId} onChange={(event) => setDealId(event.target.value)} required placeholder="Deal id" className="h-10 rounded-md border border-slate-200 px-3" />
        <input aria-label="Visit time" type="datetime-local" value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} required className="h-10 rounded-md border border-slate-200 px-3" />
        <button type="submit" className="rounded-md bg-orange-600 px-3 text-sm font-semibold text-white">Schedule</button>
      </form>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <ul className="space-y-2">
        {visits.map((visit) => (
          <li key={visit.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm">
            <span>{visit.dealId} · {visit.scheduledAt} · {visit.status}</span>
            <span className="flex gap-2">
              <button type="button" className="rounded border border-slate-300 px-2 py-1" onClick={() => setStatus(visit.id, 'completed')}>Complete</button>
              <button type="button" className="rounded border border-slate-300 px-2 py-1" onClick={() => setStatus(visit.id, 'cancelled')}>Cancel</button>
            </span>
          </li>
        ))}
        {!visits.length ? <li className="text-sm text-slate-500">No visits scheduled.</li> : null}
      </ul>
    </div>
  );
}
