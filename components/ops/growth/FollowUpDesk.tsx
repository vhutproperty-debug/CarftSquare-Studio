'use client';

import { useEffect, useState } from 'react';

type Template = { name: string; language: string; status: string };
type Batch = { id: string; templateName: string; status: string; bulk: boolean; recipients: Array<{ phone: string }>; deliveries: Array<{ phone: string; status: string }> };

export default function FollowUpDesk() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [reason, setReason] = useState('');
  const [templateName, setTemplateName] = useState('');
  const [phones, setPhones] = useState('');
  const [when, setWhen] = useState('');
  const [error, setError] = useState('');

  async function load() {
    const response = await fetch('/api/ops/growth/followup', { cache: 'no-store' });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(data.error || 'Could not load follow-ups.');
      return;
    }
    setTemplates(data.templates || []);
    setBatches(data.batches || []);
    setReason(data.sendingBlocked ? data.sendBlockReason || 'Sending is blocked.' : 'Sending is allowed.');
  }

  useEffect(() => { load(); }, []);

  async function post(body: Record<string, unknown>) {
    setError('');
    const response = await fetch('/api/ops/growth/followup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) setError(data.error || 'The action was refused.');
    await load();
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600">{reason} Bulk sends wait for a super admin. Approval does not send by itself.</p>
      {error ? <p className="text-sm text-rose-700">{error}</p> : null}
      <button type="button" className="rounded border px-3 py-1.5 text-sm" onClick={() => post({ action: 'sync' })}>Sync approved templates</button>
      <div className="grid gap-2 rounded-md border border-slate-200 bg-white p-3">
        <select className="rounded border px-2 py-1 text-sm" value={templateName} onChange={(event) => setTemplateName(event.target.value)}>
          <option value="">Template</option>
          {templates.map((row) => <option key={`${row.name}:${row.language}`} value={row.name}>{row.name} · {row.status}</option>)}
        </select>
        <input className="rounded border px-2 py-1 text-sm" placeholder="Phones, comma separated" value={phones} onChange={(event) => setPhones(event.target.value)} />
        <input className="rounded border px-2 py-1 text-sm" placeholder="2026-11-04T10:00:00.000Z" value={when} onChange={(event) => setWhen(event.target.value)} />
        <button type="button" className="rounded bg-slate-900 px-3 py-1.5 text-sm text-white" onClick={() => post({
          action: 'schedule',
          templateName,
          scheduledFor: when,
          recipients: phones.split(',').map((phone) => ({ phone: phone.trim() })).filter((row) => row.phone),
        })}>Schedule</button>
      </div>
      <ul className="space-y-2 text-sm">
        {batches.map((batch) => (
          <li key={batch.id} className="rounded-md border border-slate-200 bg-white p-3">
            <p className="font-semibold">{batch.templateName} · {batch.status} · {batch.recipients.length} recipient{batch.recipients.length === 1 ? '' : 's'}</p>
            <p className="text-slate-500">{batch.deliveries.map((row) => `${row.phone.slice(-4)} ${row.status}`).join(', ') || 'No delivery yet'}</p>
            <div className="mt-2 flex gap-2">
              {batch.bulk && batch.status === 'pending_approval' ? <button type="button" className="rounded border px-2 py-1" onClick={() => post({ action: 'approve', id: batch.id })}>Approve bulk</button> : null}
              <button type="button" className="rounded border px-2 py-1" onClick={() => post({ action: 'send', id: batch.id })}>Queue send</button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
