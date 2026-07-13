'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import SupplyDrawer from '@/components/ops/supply/SupplyDrawer';
import SupplyFilters, { type SupplyFilterState } from '@/components/ops/supply/SupplyFilters';
import SupplyKpiHeader from '@/components/ops/supply/SupplyKpiHeader';
import SupplyQueueTable from '@/components/ops/supply/SupplyQueueTable';
import type { SupplyQueueItem, SupplyWorkspaceMetrics } from '@/lib/ops/supply/types';

function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

const DEFAULT_FILTERS: SupplyFilterState = {
  search: '',
  sort: 'updatedAt',
  sortDir: 'desc',
  project: '',
  building: '',
  configuration: '',
  listingType: 'all',
  assignedBroker: 'all',
  availabilityStatus: '',
  exclusive: false,
  keysAvailable: false,
  agreementExpiring: false,
  readyForMatching: false,
  status: 'all',
  priority: 'all',
  mineOnly: false,
  followUpToday: false,
  overdueOnly: false,
};

export default function SupplyWorkspace() {
  const [filters, setFilters] = useState<SupplyFilterState>(DEFAULT_FILTERS);
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebouncedValue(filters.search, 300);
  const [items, setItems] = useState<SupplyQueueItem[]>([]);
  const [metrics, setMetrics] = useState<SupplyWorkspaceMetrics | null>(null);
  const [team, setTeam] = useState<Array<{ id: string; name: string; email: string }>>([]);
  const [currentUserId, setCurrentUserId] = useState<string | undefined>();
  const [pagination, setPagination] = useState({ page: 1, pageSize: 25, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const loadWorkspace = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: '25', sort: filters.sort, sortDir: filters.sortDir });
      if (debouncedSearch.trim()) params.set('search', debouncedSearch.trim());
      if (filters.status !== 'all') params.set('status', filters.status);
      if (filters.priority !== 'all') params.set('priority', filters.priority);
      if (filters.listingType !== 'all') params.set('listingType', filters.listingType);
      if (filters.project.trim()) params.set('project', filters.project.trim());
      if (filters.building.trim()) params.set('building', filters.building.trim());
      if (filters.configuration.trim()) params.set('configuration', filters.configuration.trim());
      if (filters.assignedBroker !== 'all') params.set('assignedBroker', filters.assignedBroker);
      if (filters.availabilityStatus.trim()) params.set('availabilityStatus', filters.availabilityStatus.trim());
      if (filters.exclusive) params.set('exclusive', 'true');
      if (filters.keysAvailable) params.set('keysAvailable', 'true');
      if (filters.agreementExpiring) params.set('agreementExpiring', 'true');
      if (filters.readyForMatching) params.set('readyForMatching', 'true');
      if (filters.mineOnly) params.set('mineOnly', 'true');
      if (filters.followUpToday) params.set('followUpToday', 'true');
      if (filters.overdueOnly) params.set('overdueOnly', 'true');

      const [queueRes, teamRes, authRes] = await Promise.all([
        fetch(`/api/ops/supply/queue?${params.toString()}`, { credentials: 'include' }),
        fetch('/api/ops/team', { credentials: 'include' }),
        fetch('/api/auth/status', { credentials: 'include' }),
      ]);

      const queueData = await queueRes.json().catch(() => ({}));
      if (!queueRes.ok) {
        setError(queueData.error || 'Unable to load supply workspace.');
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
      setError('Unable to load supply workspace.');
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, filters, page]);

  useEffect(() => {
    loadWorkspace();
  }, [loadWorkspace]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, filters.status, filters.priority, filters.listingType, filters.project, filters.building, filters.configuration, filters.assignedBroker, filters.exclusive, filters.keysAvailable, filters.agreementExpiring, filters.readyForMatching, filters.mineOnly, filters.followUpToday, filters.overdueOnly, filters.sort]);

  function openDrawer(item: SupplyQueueItem) {
    setSelectedId(item.id);
    setDrawerOpen(true);
  }

  async function createListing() {
    setCreating(true);
    try {
      const res = await fetch('/api/ops/supply/queue', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: 'manual_inventory',
          listingType: 'rent',
          status: 'NEW',
        }),
      });
      const data = await res.json();
      if (res.ok && data.record?.id) {
        setSelectedId(data.record.id);
        setDrawerOpen(true);
        await loadWorkspace();
      }
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={createListing} disabled={creating}>
          <Plus className="mr-2 h-4 w-4" />
          Add listing
        </Button>
      </div>

      {metrics ? <SupplyKpiHeader metrics={metrics} /> : null}

      <SupplyFilters
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
          Loading supply inventory…
        </div>
      ) : (
        <SupplyQueueTable items={items} selectedId={selectedId} onSelect={openDrawer} />
      )}

      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-600">
          Page {pagination.page} of {pagination.totalPages} · {pagination.total} listings
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

      <SupplyDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        supplyId={selectedId}
        currentUserId={currentUserId}
        onUpdated={loadWorkspace}
      />
    </div>
  );
}
