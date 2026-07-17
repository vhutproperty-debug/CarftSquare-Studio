'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import DemandDrawer from '@/components/ops/demand/DemandDrawer';
import DemandFilters, { type DemandFilterState } from '@/components/ops/demand/DemandFilters';
import DemandKpiHeader from '@/components/ops/demand/DemandKpiHeader';
import DemandQueueTable from '@/components/ops/demand/DemandQueueTable';
import DemandSourceBreakdown from '@/components/ops/demand/DemandSourceBreakdown';
import type { DemandQueueItem, DemandWorkspaceMetrics, DemandSourceBreakdownItem } from '@/lib/ops/demand/types';

function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

type DemandWorkspaceProps = {
  /** Bump to force a full remount/reload from parent (e.g. after create). */
  refreshToken?: number;
};

export default function DemandWorkspace({ refreshToken = 0 }: DemandWorkspaceProps) {
  const [filters, setFilters] = useState<DemandFilterState>({
    search: '',
    source: 'all',
    status: 'all',
    priority: 'all',
    assignedTo: 'all',
    rentBuy: 'all',
    project: '',
    building: '',
    dateFrom: '',
    dateTo: '',
    mineOnly: false,
    followUpToday: false,
    overdueOnly: false,
  });
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebouncedValue(filters.search, 300);
  const [items, setItems] = useState<DemandQueueItem[]>([]);
  const [metrics, setMetrics] = useState<DemandWorkspaceMetrics | null>(null);
  const [sourceBreakdown, setSourceBreakdown] = useState<DemandSourceBreakdownItem[]>([]);
  const [team, setTeam] = useState<Array<{ id: string; name: string; email: string }>>([]);
  const [currentUserId, setCurrentUserId] = useState<string | undefined>();
  const [pagination, setPagination] = useState({ page: 1, pageSize: 25, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<DemandQueueItem | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const loadWorkspace = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: '25' });
      if (debouncedSearch.trim()) params.set('search', debouncedSearch.trim());
      if (filters.source !== 'all') params.set('source', filters.source);
      if (filters.status !== 'all') params.set('status', filters.status);
      if (filters.priority !== 'all') params.set('priority', filters.priority);
      if (filters.assignedTo !== 'all') params.set('assignedTo', filters.assignedTo);
      if (filters.rentBuy !== 'all') params.set('rentBuy', filters.rentBuy);
      if (filters.project.trim()) params.set('project', filters.project.trim());
      if (filters.building.trim()) params.set('building', filters.building.trim());
      if (filters.dateFrom) params.set('dateFrom', new Date(filters.dateFrom).toISOString());
      if (filters.dateTo) params.set('dateTo', new Date(filters.dateTo).toISOString());
      if (filters.mineOnly) params.set('mineOnly', 'true');
      if (filters.followUpToday) params.set('followUpToday', 'true');
      if (filters.overdueOnly) params.set('overdueOnly', 'true');

      const [queueRes, teamRes, authRes] = await Promise.all([
        fetch(`/api/ops/demand/queue?${params.toString()}`, { credentials: 'include' }),
        fetch('/api/ops/team', { credentials: 'include' }),
        fetch('/api/auth/status', { credentials: 'include' }),
      ]);

      const queueData = await queueRes.json().catch(() => ({}));
      if (!queueRes.ok) {
        setError(queueData.error || 'Unable to load demand workspace.');
        return;
      }

      setItems(queueData.items || []);
      setMetrics(queueData.metrics || null);
      setSourceBreakdown(queueData.sourceBreakdown || []);
      setPagination(queueData.pagination || { page: 1, pageSize: 25, total: 0, totalPages: 1 });

      const teamData = await teamRes.json().catch(() => ({}));
      if (teamRes.ok) setTeam(teamData.members || []);

      const authData = await authRes.json().catch(() => ({}));
      if (authRes.ok) setCurrentUserId(authData.user?.id);
    } catch {
      setError('Unable to load demand workspace.');
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, filters, page]);

  useEffect(() => {
    loadWorkspace();
  }, [loadWorkspace, refreshToken]);

  useEffect(() => {
    setPage(1);
  }, [
    debouncedSearch,
    filters.source,
    filters.status,
    filters.priority,
    filters.assignedTo,
    filters.rentBuy,
    filters.project,
    filters.building,
    filters.dateFrom,
    filters.dateTo,
    filters.mineOnly,
    filters.followUpToday,
    filters.overdueOnly,
  ]);

  function openDrawer(item: DemandQueueItem) {
    setSelected(item);
    setDrawerOpen(true);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      {metrics ? <DemandKpiHeader metrics={metrics} /> : null}
      {sourceBreakdown.length ? <DemandSourceBreakdown items={sourceBreakdown} /> : null}

      <DemandFilters
        filters={filters}
        onChange={setFilters}
        team={team}
        currentUserId={currentUserId}
      />

      {error ? (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="px-6 py-10 text-center text-sm text-slate-500">Loading demand queue…</div>
        ) : (
          <DemandQueueTable
            items={items}
            selectedKey={selected?.key || null}
            onSelect={openDrawer}
          />
        )}
      </div>

      <div className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-slate-600">
          Page {pagination.page} of {pagination.totalPages} · {pagination.total} enquiries
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8"
            disabled={loading || pagination.page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8"
            disabled={loading || pagination.page >= pagination.totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      </div>

      <DemandDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        item={selected}
        currentUserId={currentUserId}
        onUpdated={loadWorkspace}
      />
    </div>
  );
}
