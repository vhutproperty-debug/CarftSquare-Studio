'use client';

import { useCallback, useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { buildTelLink, buildWhatsAppLink } from '@/lib/ops/phone';
import { EXPIRY_BUCKET_LABELS, EXPIRY_BUCKETS, RERENT_STATUS_LABELS, RERENT_STATUSES, type ExpiryBucket, type RerentLease, type RerentStatus } from '@/lib/ops/rerent/types';

type Row = RerentLease & { bucket: ExpiryBucket };

const selectClass = 'h-9 rounded-md border border-slate-200 bg-white px-2 text-sm';

export default function RerentWorkspace() {
  const [bucket, setBucket] = useState<ExpiryBucket | ''>('');
  const [project, setProject] = useState('');
  const [status, setStatus] = useState('');
  const [items, setItems] = useState<Row[]>([]);
  const [projects, setProjects] = useState<string[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (bucket) params.set('bucket', bucket);
    if (project) params.set('project', project);
    if (status) params.set('status', status);
    const response = await fetch(`/api/ops/rerent?${params}`, { credentials: 'include' });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(body.error || 'Unable to load leases.');
      return;
    }
    setItems(body.items || []);
    setProjects(body.projects || []);
    setCanManage(Boolean(body.canManage));
    setError('');
  }, [bucket, project, status]);

  useEffect(() => { load(); }, [load]);

  async function patch(row: Row, change: Record<string, unknown>) {
    const response = await fetch('/api/ops/rerent', {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...row, ...change }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) setError(body.error || 'Unable to update the lease.');
    else await load();
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">Lease expiries. Call and WhatsApp open on the phone you tap. Nothing is sent from the server.</p>
      <div className="flex flex-wrap gap-2">
        <select className={selectClass} aria-label="Expiry bucket" value={bucket} onChange={(event) => setBucket(event.target.value as ExpiryBucket | '')}>
          <option value="">All expiries</option>
          {EXPIRY_BUCKETS.map((item) => <option key={item} value={item}>{EXPIRY_BUCKET_LABELS[item]}</option>)}
        </select>
        <select className={selectClass} aria-label="Project" value={project} onChange={(event) => setProject(event.target.value)}>
          <option value="">All projects</option>
          {projects.map((item) => <option key={item}>{item}</option>)}
        </select>
        <select className={selectClass} aria-label="Status" value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="">All statuses</option>
          {RERENT_STATUSES.map((item) => <option key={item} value={item}>{RERENT_STATUS_LABELS[item]}</option>)}
        </select>
      </div>
      {error ? <p className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</p> : null}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-3">Lease</th>
              <th className="px-3 py-3">Expiry</th>
              <th className="px-3 py-3">Status</th>
              <th className="px-3 py-3">Remarks</th>
              <th className="px-3 py-3">Reach</th>
            </tr>
          </thead>
          <tbody>
            {items.map((row) => {
              const call = buildTelLink(row.phone_e164);
              const whatsapp = buildWhatsAppLink(row.phone_e164, `Hi ${row.name.split(' ')[0] || ''}, checking in on ${row.project}.`);
              return (
                <tr key={row.id} className="border-t border-slate-100 align-top">
                  <td className="px-3 py-3">
                    <p className="font-medium text-slate-900">{row.name}</p>
                    <p className="text-slate-600">{row.phone_e164}</p>
                    <p className="text-xs text-slate-500">{row.project} · Tower {row.tower || '—'} · {row.flat || 'Flat not set'}</p>
                  </td>
                  <td className="px-3 py-3">
                    <p>{row.lease_end || 'No end date'}</p>
                    <p className="text-xs text-slate-500">{EXPIRY_BUCKET_LABELS[row.bucket]}</p>
                  </td>
                  <td className="px-3 py-3">
                    <select className={selectClass} aria-label={`Status for ${row.name}`} value={row.status} disabled={!canManage} onChange={(event) => patch(row, { status: event.target.value })}>
                      {RERENT_STATUSES.map((item) => <option key={item} value={item}>{RERENT_STATUS_LABELS[item]}</option>)}
                    </select>
                  </td>
                  <td className="px-3 py-3">
                    <Input defaultValue={row.remarks} aria-label={`Remarks for ${row.name}`} disabled={!canManage} onBlur={(event) => { if (event.target.value !== row.remarks) patch(row, { remarks: event.target.value, note: event.target.value }); }} />
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex flex-col gap-1">
                      {call ? <a className="text-sm font-medium text-orange-700" href={call}>Call</a> : null}
                      {whatsapp ? <a className="text-sm font-medium text-emerald-700" href={whatsapp} target="_blank" rel="noreferrer">WhatsApp</a> : null}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {items.length === 0 ? <p className="px-4 py-8 text-center text-sm text-slate-500">No leases in this bucket.</p> : null}
      </div>
    </div>
  );
}
