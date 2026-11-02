'use client';

import { useMemo, useState } from 'react';
import { parseCsv } from '@/lib/ops/csv';
import { CANONICAL_FIELDS, recordsFromTable, suggestMapping, type CanonicalField } from '@/lib/ops/contacts/columns';

type Report = {
  job: { id: string; status: string; counts: Record<string, number> };
  conflicts: Array<{ index: number; phoneKeys: string[]; conflicts: Array<{ field: string; existing: string; incoming: string }> }>;
  remaining: number;
};

const selectClass = 'h-10 w-full rounded-md border border-slate-200 bg-white px-2 text-sm';

export default function ImportWorkspace() {
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Partial<Record<CanonicalField, string>>>({});
  const [extraPhones, setExtraPhones] = useState<string[]>([]);
  const [filename, setFilename] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [jobId, setJobId] = useState('');
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState('');
  const [busy, setBusy] = useState(false);

  const preview = useMemo(() => recordsFromTable(headers, rows.slice(0, 5), mapping, extraPhones), [extraPhones, headers, mapping, rows]);

  async function onFile(next: File | null) {
    setFile(next);
    setReport(null);
    setJobId('');
    setError('');
    if (!next) return;
    setFilename(next.name);
    if (next.name.toLowerCase().endsWith('.csv') || next.type.includes('csv') || next.name.toLowerCase().endsWith('.txt')) {
      const text = await next.text();
      const table = parseCsv(text);
      const [head, ...body] = table;
      setHeaders(head || []);
      setRows(body);
      const suggested = suggestMapping(head || []);
      setMapping(suggested.mapping);
      setExtraPhones(suggested.extraPhones);
      return;
    }
    if (next.size > 4_000_000) {
      setError('This spreadsheet is over 4MB. Save it as CSV so it can be sent in batches.');
      return;
    }
    const form = new FormData();
    form.set('file', next);
    const response = await fetch('/api/ops/contacts/import/preview', { method: 'POST', body: form, credentials: 'include' });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(body.error || 'Only a super admin can import contacts.');
      return;
    }
    setHeaders(body.headers || []);
    setRows(body.sample || []);
    setMapping(body.suggested?.mapping || {});
    setExtraPhones(body.suggested?.extraPhones || []);
  }

  async function stage() {
    setBusy(true);
    setError('');
    const created = await fetch('/api/ops/contacts/import/jobs', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename }),
    });
    const createdBody = await created.json().catch(() => ({}));
    if (!created.ok) {
      setBusy(false);
      setError(createdBody.error || 'Only a super admin can import contacts.');
      return;
    }
    const id = createdBody.job.id as string;
    setJobId(id);
    const csvLike = file && (file.name.toLowerCase().endsWith('.csv') || file.name.toLowerCase().endsWith('.txt'));
    if (csvLike) {
      const records = recordsFromTable(headers, rows, mapping, extraPhones);
      const batchSize = 300;
      for (let index = 0; index < records.length; index += batchSize) {
        setProgress(`Checking rows ${index + 1}–${Math.min(index + batchSize, records.length)} of ${records.length}`);
        const response = await fetch(`/api/ops/contacts/import/jobs/${id}/stage`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ startIndex: index, rows: records.slice(index, index + batchSize) }),
        });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) {
          setBusy(false);
          setError(body.error || 'Unable to stage rows.');
          return;
        }
      }
    } else if (file) {
      const form = new FormData();
      form.set('file', file);
      form.set('mapping', JSON.stringify(mapping));
      form.set('extraPhones', JSON.stringify(extraPhones));
      setProgress('Reading the spreadsheet on the server…');
      const response = await fetch(`/api/ops/contacts/import/jobs/${id}/file`, { method: 'POST', body: form, credentials: 'include' });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setBusy(false);
        setError(body.error || 'Unable to stage the file.');
        return;
      }
    }
    const reportResponse = await fetch(`/api/ops/contacts/import/jobs/${id}`, { credentials: 'include' });
    const reportBody = await reportResponse.json().catch(() => ({}));
    setBusy(false);
    setProgress('');
    if (!reportResponse.ok) {
      setError(reportBody.error || 'Unable to load the dedupe report.');
      return;
    }
    setReport(reportBody);
  }

  async function commit() {
    if (!jobId) return;
    setBusy(true);
    setError('');
    let remaining = 1;
    while (remaining > 0) {
      const response = await fetch(`/api/ops/contacts/import/jobs/${jobId}/commit`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limit: 200 }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setBusy(false);
        setError(body.error || 'Unable to import.');
        return;
      }
      remaining = Number(body.remaining || 0);
      setProgress(remaining ? `${remaining} rows left` : 'Import finished');
      setReport((current) => current ? { ...current, job: body.job, remaining } : current);
    }
    const reportResponse = await fetch(`/api/ops/contacts/import/jobs/${jobId}`, { credentials: 'include' });
    setReport(await reportResponse.json());
    setBusy(false);
  }

  async function undo() {
    if (!jobId) return;
    setBusy(true);
    const response = await fetch(`/api/ops/contacts/import/jobs/${jobId}/undo`, { method: 'POST', credentials: 'include' });
    const body = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) {
      setError(body.error || 'Unable to undo.');
      return;
    }
    setProgress('Import undone.');
    setReport((current) => current ? { ...current, job: body.job } : current);
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">Rows can omit the flat and email. The same phone updates the existing contact and leaves non-empty fields as they are. Conflicts are listed before anything is written.</p>
      <label className="block text-sm font-semibold text-slate-700">
        CSV or XLSX
        <input type="file" accept=".csv,.xlsx,text/csv" className="mt-1 block text-sm" onChange={(event) => onFile(event.target.files?.[0] || null)} />
      </label>
      {headers.length ? (
        <div className="grid gap-3 md:grid-cols-3">
          {CANONICAL_FIELDS.map((field) => (
            <label key={field} className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {field.replaceAll('_', ' ')}
              <select className={`${selectClass} mt-1 normal-case`} value={mapping[field] || ''} onChange={(event) => setMapping({ ...mapping, [field]: event.target.value })}>
                <option value="">Skip</option>
                {headers.map((header) => <option key={header} value={header}>{header}</option>)}
              </select>
            </label>
          ))}
        </div>
      ) : null}
      {preview.length ? (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="min-w-full text-left text-xs">
            <thead className="border-b text-slate-500"><tr>{['name', 'phone', 'email', 'complex', 'flat'].map((key) => <th key={key} className="px-3 py-2">{key}</th>)}</tr></thead>
            <tbody>
              {preview.map((row, index) => (
                <tr key={index} className="border-b border-slate-100">
                  {['name', 'phone', 'email', 'complex', 'flat'].map((key) => <td key={key} className="px-3 py-2">{row[key] || '—'}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={busy || !headers.length} onClick={stage} className="min-h-10 rounded-md bg-slate-900 px-3 text-sm font-semibold text-white disabled:opacity-50">Check duplicates</button>
        <button type="button" disabled={busy || !report} onClick={commit} className="min-h-10 rounded-md bg-orange-600 px-3 text-sm font-semibold text-white disabled:opacity-50">Import batch</button>
        <button type="button" disabled={busy || !jobId} onClick={undo} className="min-h-10 rounded-md border border-slate-300 px-3 text-sm font-semibold disabled:opacity-50">Undo import</button>
      </div>
      {progress ? <p className="text-sm text-slate-600">{progress}</p> : null}
      {error ? <p className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</p> : null}
      {report ? (
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="font-semibold text-slate-900">Dedupe report</h2>
          <p className="mt-1 text-sm text-slate-600">
            Staged {report.job.counts.staged || 0} · new or merged candidates {report.remaining} still waiting · conflicts {report.job.counts.conflicts || 0} · invalid {report.job.counts.invalid || 0} · folded {report.job.counts.folded || 0} · status {report.job.status}
          </p>
          {report.conflicts?.length ? (
            <ul className="mt-3 space-y-2 text-sm">
              {report.conflicts.map((row) => (
                <li key={row.index} className="rounded-md bg-amber-50 px-3 py-2">
                  Row {row.index + 1} · {row.phoneKeys.join(', ') || 'no phone'}
                  {row.conflicts.map((conflict, index) => (
                    <span key={index} className="mt-1 block text-amber-950">{conflict.field}: keep “{conflict.existing}”, file says “{conflict.incoming}”</span>
                  ))}
                </li>
              ))}
            </ul>
          ) : <p className="mt-2 text-sm text-slate-500">No field conflicts in the sample.</p>}
        </section>
      ) : null}
    </div>
  );
}
