'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import RevenueDrawer from '@/components/ops/revenue/RevenueDrawer';
import RevenueFilters, { type RevenueFilterState } from '@/components/ops/revenue/RevenueFilters';
import RevenueKpiHeader from '@/components/ops/revenue/RevenueKpiHeader';
import RevenueQueue from '@/components/ops/revenue/RevenueQueue';
import { formatOpsCurrency } from '@/components/ops/format';
import type { RevenueQueueItem, RevenueWorkspaceMetrics } from '@/lib/ops/revenue/types';

function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

const DEFAULT_FILTERS: RevenueFilterState = {
  search: '',
  status: 'all',
  streamType: 'all',
  broker: 'all',
  overdueOnly: false,
  mineOnly: false,
};

export default function RevenueWorkspace() {
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebouncedValue(filters.search, 300);
  const [items, setItems] = useState<RevenueQueueItem[]>([]);
  const [metrics, setMetrics] = useState<RevenueWorkspaceMetrics | null>(null);
  const [brokerBreakdown, setBrokerBreakdown] = useState<Array<{ brokerId: string; brokerName: string; expected: number; collected: number; pending: number }>>([]);
  const [team, setTeam] = useState<Array<{ id: string; name: string; email: string }>>([]);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 25, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const loadWorkspace = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: '25' });
      if (debouncedSearch.trim()) params.set('search', debouncedSearch.trim());
      if (filters.status !== 'all') params.set('status', filters.status);
      if (filters.streamType !== 'all') params.set('streamType', filters.streamType);
      if (filters.broker !== 'all') params.set('broker', filters.broker);
      if (filters.overdueOnly) params.set('overdueOnly', 'true');
      if (filters.mineOnly) params.set('mineOnly', 'true');

      const [queueRes, teamRes] = await Promise.all([
        fetch(`/api/ops/revenue/queue?${params.toString()}`, { credentials: 'include' }),
        fetch('/api/ops/team', { credentials: 'include' }),
      ]);
      const queueData = await queueRes.json().catch(() => ({}));
      if (!queueRes.ok) {
        setError(queueData.error || 'Unable to load revenue workspace.');
        return;
      }
      setItems(queueData.items || []);
      setMetrics(queueData.metrics || null);
      setBrokerBreakdown(queueData.brokerBreakdown || []);
      setPagination(queueData.pagination || { page: 1, pageSize: 25, total: 0, totalPages: 1 });
      const teamData = await teamRes.json().catch(() => ({}));
      if (teamRes.ok) setTeam(teamData.members || []);
    } catch {
      setError('Unable to load revenue workspace.');
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, filters, page]);

  useEffect(() => { loadWorkspace(); }, [loadWorkspace]);
  useEffect(() => { setPage(1); }, [debouncedSearch, filters.status, filters.streamType, filters.broker, filters.overdueOnly, filters.mineOnly]);

  async function syncFromDeals() {
    setSyncing(true);
    try {
      await fetch('/api/ops/revenue/queue', { method: 'POST', credentials: 'include' });
      await loadWorkspace();
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-600">Sync eligible deals to track expected brokerage, collections, and overdue commissions.</p>
        <Button onClick={syncFromDeals} disabled={syncing}>{syncing ? 'Syncing…' : 'Sync from deals'}</Button>
      </div>

      {metrics ? <RevenueKpiHeader metrics={metrics} /> : null}

      {brokerBreakdown.length > 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Broker pending commissions</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {brokerBreakdown.slice(0, 6).map((b) => (
              <div key={b.brokerId} className="rounded-lg bg-slate-50 px-3 py-2 text-sm">
                <p className="font-semibold text-slate-900">{b.brokerName}</p>
                <p className="text-slate-600">{formatOpsCurrency(b.pending)} pending · {formatOpsCurrency(b.collected)} collected</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <RevenueFilters filters={filters} onChange={setFilters} team={team} />
      {error ? <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div> : null}
      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white px-6 py-12 text-center text-sm text-slate-500">Loading revenue…</div>
      ) : (
        <RevenueQueue items={items} selectedId={selectedId} onSelect={(item) => { setSelectedId(item.id); setDrawerOpen(true); }} />
      )}

      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-600">Page {pagination.page} of {pagination.totalPages} · {pagination.total} records</p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={loading || pagination.page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Previous</Button>
          <Button variant="outline" size="sm" disabled={loading || pagination.page >= pagination.totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
        </div>
      </div>

      <RevenueDrawer open={drawerOpen} onOpenChange={setDrawerOpen} recordId={selectedId} onUpdated={loadWorkspace} />
    </div>
  );
}
