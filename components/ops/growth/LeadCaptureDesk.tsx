'use client';

import { useEffect, useState } from 'react';

type EventRow = {
  id: string;
  source: string;
  externalId: string;
  name: string;
  phone: string;
  message: string;
  campaignId: string;
  status: string;
  at: string;
};

export default function LeadCaptureDesk() {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [leadgenId, setLeadgenId] = useState('');
  const [error, setError] = useState('');
  const [note, setNote] = useState('');

  async function load() {
    const response = await fetch('/api/ops/growth/capture', { cache: 'no-store' });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(data.error || 'Could not load captured leads.');
      return;
    }
    setEvents(data.events || []);
  }

  useEffect(() => { load(); }, []);

  async function fetchLead() {
    setError('');
    setNote('');
    const response = await fetch('/api/ops/growth/capture', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ leadgenId }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(data.error || 'Could not fetch the lead.');
      return;
    }
    setNote(data.fetched ? 'Lead stored with form answers.' : 'leads_retrieval is not granted. The lead is stored without answers.');
    await load();
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600">Meta Instant Form and WhatsApp enquiries land in the unified inbox. Repeats of the same id are ignored.</p>
      {error ? <p className="text-sm text-rose-700">{error}</p> : null}
      {note ? <p className="text-sm text-slate-700">{note}</p> : null}
      <div className="flex flex-wrap gap-2">
        <input className="rounded border px-2 py-1 text-sm" placeholder="Meta lead id" value={leadgenId} onChange={(event) => setLeadgenId(event.target.value)} />
        <button type="button" className="rounded bg-slate-900 px-3 py-1.5 text-sm text-white" onClick={fetchLead}>Fetch lead</button>
      </div>
      <ul className="space-y-2">
        {events.map((row) => (
          <li key={row.id} className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm">
            <p className="text-xs font-bold uppercase text-slate-500">{row.source} · {row.status}</p>
            <p className="font-semibold">{row.name || row.externalId}</p>
            <p className="text-slate-600">{[row.phone, row.campaignId, row.message].filter(Boolean).join(' · ')}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
