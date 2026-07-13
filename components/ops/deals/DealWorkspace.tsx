'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import DealDrawer from '@/components/ops/deals/DealDrawer';
import DealFilters, { type DealFilterState } from '@/components/ops/deals/DealFilters';
import DealKpiHeader from '@/components/ops/deals/DealKpiHeader';
import DealQueue from '@/components/ops/deals/DealQueue';
import type { DealQueueItem, DealWorkspaceMetrics } from '@/lib/ops/deals/types';

function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

const DEFAULT_FILTERS: DealFilterState = {
  search: '',
  project: '',
  broker: 'all',
  stage: 'all',
  transactionType: 'all',
  minProbability: '',
  paymentStatus: 'all',
  dateFrom: '',
  mineOnly: false,
  activeOnly: true,
};

export default function DealWorkspace() {
  const [filters, setFilters] = useState<DealFilterState>(DEFAULT_FILTERS);
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebouncedValue(filters.search, 300);
  const [items, setItems] = useState<DealQueueItem[]>([]);
  const [metrics, setMetrics] = useState<DealWorkspaceMetrics | null>(null);
  const [team, setTeam] = useState<Array<{ id: string; name: string; email: string }>>([]);
  const [currentUserId, setCurrentUserId] = useState<string | undefined>();
  const [pagination, setPagination] = useState({ page: 1, pageSize: 25, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const loadWorkspace = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: '25' });
      if (debouncedSearch.trim()) params.set('search', debouncedSearch.trim());
      if (filters.stage !== 'all') params.set('stage', filters.stage);
      if (filters.project.trim()) params.set('project', filters.project.trim());
      if (filters.transactionType !== 'all') params.set('transactionType', filters.transactionType);
      if (filters.minProbability.trim()) params.set('minProbability', filters.minProbability.trim());
      if (filters.broker !== 'all') params.set('broker', filters.broker);
      if (filters.paymentStatus !== 'all') params.set('paymentStatus', filters.paymentStatus);
      if (filters.dateFrom) params.set('dateFrom', new Date(filters.dateFrom).toISOString());
      if (filters.mineOnly) params.set('mineOnly', 'true');
      if (filters.activeOnly) params.set('activeOnly', 'true');

      const [queueRes, teamRes, authRes] = await Promise.all([
        fetch(`/api/ops/deals/queue?${params.toString()}`, { credentials: 'include' }),
        fetch('/api/ops/team', { credentials: 'include' }),
        fetch('/api/auth/status', { credentials: 'include' }),
      ]);

      const queueData = await queueRes.json().catch(() => ({}));
      if (!queueRes.ok) {
        setError(queueData.error || 'Unable to load deal workspace.');
        return;
      }

      setItems(queueData.items || []);
      setMetrics(queueData.metrics || null);
      setPagination(queueData.pagination || { page: 1, pageSize: 25, total: 0, totalPages: 1 });

      const teamData = await teamRes.json().catch(() => ({}));
      if (teamRes.ok) setTeam(teamData.members || []);

      const authData = await authRes.json().catch(() => ({}));
      if (authRes.ok) setCurrentUserId(authData.user?.id);
    } catch {
      setError('Unable to load deal workspace.');
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, filters, page]);

  useEffect(() => {
    loadWorkspace();
  }, [loadWorkspace]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, filters.stage, filters.project, filters.transactionType, filters.minProbability, filters.broker, filters.paymentStatus, filters.mineOnly, filters.activeOnly]);

  function openDrawer(item: DealQueueItem) {
    setSelectedId(item.id);
    setDrawerOpen(true);
  }

  return (
    <div className="space-y-4">
      {metrics ? <DealKpiHeader metrics={metrics} /> : null}

      <DealFilters
        filters={filters}
        onChange={setFilters}
        team={team}
        currentUserId={currentUserId}
      />

      {error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div>
      ) : null}

      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white px-6 py-12 text-center text-sm text-slate-500">
          Loading deals…
        </div>
      ) : (
        <DealQueue items={items} selectedId={selectedId} onSelect={openDrawer} />
      )}

      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-600">
          Page {pagination.page} of {pagination.totalPages} · {pagination.total} deals
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={loading || pagination.page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
            Previous
          </Button>
          <Button variant="outline" size="sm" disabled={loading || pagination.page >= pagination.totalPages} onClick={() => setPage((p) => p + 1)}>
            Next
          </Button>
        </div>
      </div>

      <DealDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        dealId={selectedId}
        currentUserId={currentUserId}
        onUpdated={loadWorkspace}
      />
    </div>
  );
}
