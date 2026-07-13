'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import RenewalDrawer from '@/components/ops/renewals/RenewalDrawer';
import RenewalKpiHeader from '@/components/ops/renewals/RenewalKpiHeader';
import RenewalQueue from '@/components/ops/renewals/RenewalQueue';
import type { OpsRenewalRecord, RenewalWorkspaceMetrics } from '@/lib/ops/renewals/types';
import { RENEWAL_STATUSES, RENEWAL_STATUS_LABELS } from '@/lib/ops/renewals/statuses';

export default function RenewalWorkspace() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('all');
  const [items, setItems] = useState<Array<{ id: string; record: OpsRenewalRecord }>>([]);
  const [metrics, setMetrics] = useState<RenewalWorkspaceMetrics | null>(null);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 25, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const loadWorkspace = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: '25' });
      if (statusFilter !== 'all') params.set('status', statusFilter);
      const res = await fetch(`/api/ops/renewals/queue?${params.toString()}`, { credentials: 'include' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error || 'Unable to load renewals.'); return; }
      setItems(data.items || []);
      setMetrics(data.metrics || null);
      setPagination(data.pagination || { page: 1, pageSize: 25, total: 0, totalPages: 1 });
    } catch { setError('Unable to load renewals.'); }
    finally { setLoading(false); }
  }, [page, statusFilter]);

  useEffect(() => { loadWorkspace(); }, [loadWorkspace]);
  useEffect(() => { setPage(1); }, [statusFilter]);

  async function generateFromAgreements() {
    setGenerating(true);
    try { await fetch('/api/ops/renewals/queue', { method: 'POST', credentials: 'include' }); await loadWorkspace(); }
    finally { setGenerating(false); }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-600">Generate renewal tasks from agreements approaching expiry.</p>
        <Button onClick={generateFromAgreements} disabled={generating}>{generating ? 'Generating…' : 'Generate from agreements'}</Button>
      </div>
      {metrics ? <RenewalKpiHeader metrics={metrics} /> : null}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <select className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">All statuses</option>
          {RENEWAL_STATUSES.map((s) => <option key={s} value={s}>{RENEWAL_STATUS_LABELS[s]}</option>)}
        </select>
      </div>
      {error ? <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div> : null}
      {loading ? <div className="rounded-xl border border-slate-200 bg-white px-6 py-12 text-center text-sm text-slate-500">Loading renewals…</div> : (
        <RenewalQueue items={items} selectedId={selectedId} onSelect={(id) => { setSelectedId(id); setDrawerOpen(true); }} />
      )}
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-600">Page {pagination.page} of {pagination.totalPages} · {pagination.total} renewals</p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={loading || pagination.page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Previous</Button>
          <Button variant="outline" size="sm" disabled={loading || pagination.page >= pagination.totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
        </div>
      </div>
      <RenewalDrawer open={drawerOpen} onOpenChange={setDrawerOpen} recordId={selectedId} onUpdated={loadWorkspace} />
    </div>
  );
}
