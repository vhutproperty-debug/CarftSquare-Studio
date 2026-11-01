'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Download, RefreshCw, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AdminBadge, PriorityBadge, StatusBadge } from '@/components/ops/broker-crm/badges';
import BrokerCrmTabs from '@/components/ops/broker-crm/BrokerCrmTabs';
import { formatBrokerPhone } from '@/lib/ops/broker-crm/format';
import { outreachCsvFor } from '@/lib/ops/broker-crm/privacy';
import { applyBrokerCrmQuery } from '@/lib/ops/broker-crm/query';
import type { BrokerCrmListResult, BrokerCrmStatus, OpsBrokerCrmRecord } from '@/lib/ops/broker-crm/types';
import { BROKER_CRM_STATUSES, BROKER_CRM_STATUS_LABELS } from '@/lib/ops/broker-crm/types';

type SortKey = 'priority' | 'name' | 'groupCount' | 'lastContacted';

function useDebounced(value: string, delay: number): string {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export default function BrokerCrmWorkspace({
  initialRecords,
  base = '/ops/broker-crm',
}: {
  initialRecords?: OpsBrokerCrmRecord[];
  base?: string;
}) {
  const preview = Boolean(initialRecords);
  const records = initialRecords || [];
  const [remote, setRemote] = useState<BrokerCrmListResult | null>(null);
  const [loading, setLoading] = useState(!preview);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [search, setSearch] = useState('');
  const [group, setGroup] = useState('');
  const [area, setArea] = useState('');
  const [status, setStatus] = useState<BrokerCrmStatus | 'all'>('all');
  const [priorityOnly, setPriorityOnly] = useState(false);
  const [sort, setSort] = useState<SortKey>('priority');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [importOpen, setImportOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const debouncedSearch = useDebounced(search, 250);

  const load = useCallback(async () => {
    if (preview) return;
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: '25',
        sort,
        sortDir,
        status,
      });
      if (debouncedSearch.trim()) params.set('search', debouncedSearch.trim());
      if (group) params.set('group', group);
      if (area) params.set('area', area);
      if (priorityOnly) params.set('priority', '1');
      const response = await fetch(`/api/ops/broker-crm?${params}`, { credentials: 'include' });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(body.error || 'Unable to load brokers.');
        return;
      }
      setRemote(body);
    } catch {
      setError('Unable to load brokers.');
    } finally {
      setLoading(false);
    }
  }, [area, debouncedSearch, group, page, preview, priorityOnly, sort, sortDir, status]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, group, area, status, priorityOnly, sort, sortDir]);

  const local = useMemo(() => {
    if (!preview) return null;
    return applyBrokerCrmQuery(records, {
      search: debouncedSearch,
      group,
      area,
      status,
      priorityOnly,
      sort,
      sortDir,
      page,
      pageSize: 25,
    });
  }, [area, debouncedSearch, group, page, preview, priorityOnly, records, sort, sortDir, status]);

  const view = preview ? local : remote;

  async function onImport(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (preview) {
      setNotice('This sample preview does not upload files. On the ops screen the same control upserts by phone.');
      return;
    }
    const form = event.currentTarget;
    const file = new FormData(form).get('file');
    if (!(file instanceof File) || !file.name) {
      setError('Choose a .xlsx or .csv file.');
      return;
    }
    setImporting(true);
    setError('');
    setNotice('');
    try {
      const body = new FormData();
      body.set('file', file);
      const response = await fetch('/api/ops/broker-crm/import', { method: 'POST', body, credentials: 'include' });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(payload.error || 'Unable to import brokers.');
        return;
      }
      const stats = payload.stats;
      setNotice(`Imported ${stats.created} new, updated ${stats.updated}, left ${stats.unchanged} unchanged, skipped ${stats.skipped}. Duplicate phones in the file were merged (${stats.dedupedInFile}).`);
      setImportOpen(false);
      form.reset();
      await load();
    } catch {
      setError('Unable to import brokers.');
    } finally {
      setImporting(false);
    }
  }

  function downloadPreviewExport() {
    const csv = outreachCsvFor(records);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'broker-crm-outreach-sample.csv';
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <BrokerCrmTabs current="directory" base={base} />
        <div className="flex flex-wrap gap-2">
          {preview ? (
            <Button type="button" variant="outline" size="sm" onClick={downloadPreviewExport}>
              <Download className="h-4 w-4" />
              Outreach export
            </Button>
          ) : (
            <Button type="button" variant="outline" size="sm" asChild>
              <a href="/api/ops/broker-crm/export">
                <Download className="h-4 w-4" />
                Outreach export
              </a>
            </Button>
          )}
          <Button type="button" variant="outline" size="sm" onClick={() => setImportOpen((open) => !open)}>
            <Upload className="h-4 w-4" />
            Import
          </Button>
          {preview ? null : (
            <Button type="button" variant="outline" size="sm" onClick={load} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          )}
        </div>
      </div>

      {preview ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          Sample data only. These names and numbers are invented so the screen can be reviewed without the private directory.
        </div>
      ) : null}

      {view ? (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          <Stat label="Brokers" value={view.metrics.total} />
          <Stat label="Priority" value={view.metrics.priority} />
          <Stat label="Admins" value={view.metrics.admins} />
          <Stat label="In 2+ groups" value={view.metrics.multiGroup} />
          <Stat label="Do not contact" value={view.metrics.doNotContact} tone="rose" />
        </div>
      ) : null}

      <p className="text-sm text-slate-600">
        Priority marks a group admin or anyone in more than one WhatsApp group. Do-not-contact brokers stay in the directory and are left out of outreach export and the priority queue.
      </p>

      {importOpen ? (
        <form onSubmit={onImport} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm font-medium text-slate-900">Upsert by phone</p>
          <p className="mt-1 text-sm text-slate-600">
            Use a private .xlsx or .csv with columns phone, name, groups, group_count, and admin. Groups are separated with semicolons. The file is not stored in git. Status, notes, tags, and requirements already on a broker are kept.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input
              name="file"
              type="file"
              accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              aria-label="Broker spreadsheet"
              className="text-sm text-slate-700"
            />
            <Button type="submit" size="sm" disabled={importing}>
              {importing ? 'Importing…' : 'Upsert brokers'}
            </Button>
          </div>
        </form>
      ) : null}

      <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          aria-label="Search brokers"
          placeholder="Search name, phone, group, or area"
          className="lg:max-w-sm"
        />
        <select aria-label="Filter by group" value={group} onChange={(event) => setGroup(event.target.value)} className="h-9 rounded-md border border-slate-200 bg-white px-2 text-sm">
          <option value="">All groups</option>
          {(view?.filterOptions.groups || []).map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <select aria-label="Filter by area" value={area} onChange={(event) => setArea(event.target.value)} className="h-9 rounded-md border border-slate-200 bg-white px-2 text-sm">
          <option value="">All areas</option>
          {(view?.filterOptions.areas || []).map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <select aria-label="Filter by status" value={status} onChange={(event) => setStatus(event.target.value as BrokerCrmStatus | 'all')} className="h-9 rounded-md border border-slate-200 bg-white px-2 text-sm">
          <option value="all">All statuses</option>
          {BROKER_CRM_STATUSES.map((item) => <option key={item} value={item}>{BROKER_CRM_STATUS_LABELS[item]}</option>)}
        </select>
        <select aria-label="Sort brokers" value={`${sort}:${sortDir}`} onChange={(event) => {
          const [nextSort, nextDir] = event.target.value.split(':') as [SortKey, 'asc' | 'desc'];
          setSort(nextSort);
          setSortDir(nextDir);
        }} className="h-9 rounded-md border border-slate-200 bg-white px-2 text-sm">
          <option value="priority:desc">Priority first</option>
          <option value="groupCount:desc">Most groups</option>
          <option value="name:asc">Name A–Z</option>
          <option value="lastContacted:desc">Last contacted</option>
        </select>
        <label className="flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
          <input type="checkbox" checked={priorityOnly} onChange={(event) => setPriorityOnly(event.target.checked)} />
          Priority only
        </label>
      </div>

      {error ? <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div> : null}
      {notice ? <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">{notice}</div> : null}

      {loading && !view ? (
        <div className="rounded-xl border border-slate-200 bg-white px-6 py-12 text-center text-sm text-slate-500">Loading brokers…</div>
      ) : null}

      {view && view.items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center text-sm text-slate-500">
          No brokers match this view.
        </div>
      ) : null}

      {view && view.items.length > 0 ? (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Broker</th>
                  <th className="px-4 py-3">Phone</th>
                  <th className="px-4 py-3">Groups</th>
                  <th className="px-4 py-3">Areas</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Last contacted</th>
                </tr>
              </thead>
              <tbody>
                {view.items.map((item) => (
                  <tr key={item.id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <Link href={`${base}/${item.id}`} className="font-medium text-slate-900 underline-offset-2 hover:underline">
                        {item.name}
                      </Link>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {item.priority ? <PriorityBadge /> : null}
                        {item.admin ? <AdminBadge /> : null}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{formatBrokerPhone(item.phone)}</td>
                    <td className="px-4 py-3 text-slate-700">
                      <span className="font-semibold text-slate-900">{item.groupCount}</span>
                      <span className="mt-1 block max-w-xs text-xs text-slate-500">{item.groups.slice(0, 2).join(' · ')}{item.groups.length > 2 ? ` · +${item.groups.length - 2}` : ''}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{item.areas.slice(0, 3).join(', ') || '—'}</td>
                    <td className="px-4 py-3"><StatusBadge status={item.status} /></td>
                    <td className="px-4 py-3 text-slate-600">{item.lastContactedAt || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {view ? (
        <div className="flex items-center justify-between text-sm text-slate-600">
          <span>Showing {view.pagination.total} matching brokers · page {view.pagination.page} of {view.pagination.totalPages}</span>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>Previous</Button>
            <Button type="button" variant="outline" size="sm" disabled={page >= view.pagination.totalPages} onClick={() => setPage((value) => value + 1)}>Next</Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: 'rose' }) {
  return (
    <div className={`rounded-xl border bg-white px-4 py-3 shadow-sm ${tone === 'rose' ? 'border-rose-200' : 'border-slate-200'}`}>
      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
    </div>
  );
}
