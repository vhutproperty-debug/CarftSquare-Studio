'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { buildTelLink, buildWhatsAppLink } from '@/lib/ops/phone';
import {
  LEASE_BUCKET_LABELS,
  LEASE_BUCKETS,
  LEASE_CALL_STATUS_LABELS,
  LEASE_CALL_STATUSES,
  type LeaseBucket,
  type LeaseCallStatus,
  type LeaseExpiry,
} from '@/lib/ops/lease-expiries/types';

type Row = LeaseExpiry & { daysToExpiry: number | null; bucket: LeaseBucket | '' };

const selectClass = 'h-9 rounded-md border border-slate-200 bg-white px-2 text-sm';

function reach(name: string, phone: string, project: string, tower: string, flat: string) {
  const message = `Hi ${name.split(' ')[0] || ''}, this is CraftSquare about the lease at ${project}${tower ? ` tower ${tower}` : ''} ${flat}.`.trim();
  return { call: buildTelLink(phone), whatsapp: buildWhatsAppLink(phone, message) };
}

export default function RerentCallsTab() {
  const [bucket, setBucket] = useState<LeaseBucket | ''>('');
  const [project, setProject] = useState('');
  const [items, setItems] = useState<Row[]>([]);
  const [counts, setCounts] = useState<Record<LeaseBucket, number> | null>(null);
  const [projects, setProjects] = useState<string[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (bucket) params.set('bucket', bucket);
    if (project) params.set('project', project);
    const response = await fetch(`/api/ops/outreach/lease-expiries?${params}`, { credentials: 'include' });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(body.error || 'Unable to load re-rent calls.');
      return;
    }
    setItems(body.items || []);
    setCounts(body.counts || null);
    setProjects(body.projects || []);
    setCanManage(Boolean(body.canManage));
    setError('');
  }, [bucket, project]);

  useEffect(() => { load(); }, [load]);

  async function patch(row: Row, change: Record<string, unknown>) {
    const response = await fetch('/api/ops/outreach/lease-expiries', {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: row.id, project: row.project, tower: row.tower, flat: row.flat, ...change }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) setError(body.error || 'Unable to update the lease.');
    else await load();
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">Soonest lease end first. Call and WhatsApp open on your phone. Nothing is sent from the server.</p>
      {counts ? (
        <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {LEASE_BUCKETS.map((item) => (
            <button key={item} type="button" onClick={() => setBucket(bucket === item ? '' : item)} className={`rounded-xl border bg-white px-3 py-2 text-left shadow-sm ${bucket === item ? 'border-orange-300' : 'border-slate-200'}`}>
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{LEASE_BUCKET_LABELS[item]}</p>
              <p className="text-xl font-semibold text-slate-900">{counts[item] || 0}</p>
            </button>
          ))}
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <select className={selectClass} aria-label="Filter by project" value={project} onChange={(event) => setProject(event.target.value)}>
          <option value="">All projects</option>
          {projects.map((item) => <option key={item}>{item}</option>)}
        </select>
        {canManage ? (
          <form
            className="flex flex-wrap items-center gap-2"
            onSubmit={async (event) => {
              event.preventDefault();
              const form = event.currentTarget;
              const file = new FormData(form).get('file');
              if (!(file instanceof File)) return;
              const body = new FormData();
              body.set('file', file);
              const response = await fetch('/api/ops/outreach/lease-expiries/import', { method: 'POST', body, credentials: 'include' });
              const payload = await response.json().catch(() => ({}));
              if (!response.ok) setError(payload.error || 'Import failed.');
              else {
                setNotice(`Upserted ${payload.created} new and ${payload.updated} existing leases.`);
                form.reset();
                await load();
              }
            }}
          >
            <input name="file" type="file" accept=".csv,text/csv" aria-label="Lease CSV" className="text-sm" />
            <Button type="submit" size="sm">Upload CSV</Button>
          </form>
        ) : null}
      </div>
      {error ? <p className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</p> : null}
      {notice ? <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">{notice}</p> : null}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-3">Flat</th>
                <th className="px-3 py-3">Owner</th>
                <th className="px-3 py-3">Tenant</th>
                <th className="px-3 py-3">Expiry</th>
                <th className="px-3 py-3">Call status</th>
                <th className="px-3 py-3">Notes</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => {
                const owner = reach(row.ownerName, row.ownerPhone, row.project, row.tower, row.flat);
                const tenant = reach(row.tenantName, row.tenantPhone, row.project, row.tower, row.flat);
                return (
                  <tr key={row.id} className="border-t border-slate-100 align-top">
                    <td className="px-3 py-3">
                      <p className="font-medium text-slate-900">{row.project}</p>
                      <p className="text-xs text-slate-500">Tower {row.tower || '—'} · {row.flat}</p>
                      <p className="text-xs text-slate-500">{row.priority || 'No priority'}</p>
                    </td>
                    <td className="px-3 py-3">
                      <p>{row.ownerName || '—'}</p>
                      <p className="text-slate-600">{row.ownerPhone || '—'}</p>
                      <Reach call={owner.call} whatsapp={owner.whatsapp} />
                    </td>
                    <td className="px-3 py-3">
                      <p>{row.tenantName || '—'}</p>
                      <p className="text-slate-600">{row.tenantPhone || '—'}</p>
                      <Reach call={tenant.call} whatsapp={tenant.whatsapp} />
                    </td>
                    <td className="px-3 py-3">
                      <p>{row.leaseEnd || 'No end date'}</p>
                      <p className="text-xs text-slate-500">{row.bucket ? LEASE_BUCKET_LABELS[row.bucket] : 'No end date'}{row.daysToExpiry != null ? ` · ${row.daysToExpiry} days` : ''}</p>
                      <p className="text-xs text-slate-400">Start {row.leaseStart || '—'}</p>
                    </td>
                    <td className="px-3 py-3">
                      <select className={selectClass} aria-label={`Call status for ${row.flat}`} value={row.status} disabled={!canManage} onChange={(event) => patch(row, { status: event.target.value as LeaseCallStatus })}>
                        {LEASE_CALL_STATUSES.map((item) => <option key={item} value={item}>{LEASE_CALL_STATUS_LABELS[item]}</option>)}
                      </select>
                    </td>
                    <td className="px-3 py-3">
                      <Input defaultValue={row.notes} aria-label={`Notes for ${row.flat}`} disabled={!canManage} onBlur={(event) => { if (event.target.value !== row.notes) patch(row, { notes: event.target.value, note: event.target.value }); }} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {items.length === 0 ? <p className="px-4 py-8 text-center text-sm text-slate-500">No leases in this view.</p> : null}
      </div>
    </div>
  );
}

function Reach({ call, whatsapp }: { call: string | null; whatsapp: string | null }) {
  if (!call && !whatsapp) return null;
  return (
    <p className="mt-1 flex gap-2 text-xs font-medium">
      {call ? <a className="text-orange-700" href={call}>Call</a> : null}
      {whatsapp ? <a className="text-emerald-700" href={whatsapp} target="_blank" rel="noreferrer">WhatsApp</a> : null}
    </p>
  );
}
