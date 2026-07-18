'use client';

import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import BrokerAnalyticsPanel from '@/components/ops/brokers/BrokerAnalyticsPanel';
import BrokerDirectoryPanel from '@/components/ops/brokers/BrokerDirectoryPanel';
import BrokerImportDialog from '@/components/ops/brokers/BrokerImportDialog';
import BrokerImportsPanel from '@/components/ops/brokers/BrokerImportsPanel';
import BrokerInventoryDrawer from '@/components/ops/brokers/BrokerInventoryDrawer';
import BrokerProjectsPanel from '@/components/ops/brokers/BrokerProjectsPanel';
import BrokerReviewPanel from '@/components/ops/brokers/BrokerReviewPanel';
import BrokersFilters, { type BrokersFilterState } from '@/components/ops/brokers/BrokersFilters';
import BrokersKpiHeader from '@/components/ops/brokers/BrokersKpiHeader';
import BrokersQueueTable from '@/components/ops/brokers/BrokersQueueTable';
import type {
  BrokerInventoryQueueItem,
  BrokerWorkspaceMetrics,
} from '@/lib/ops/brokers/types';

function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

const DEFAULT_FILTERS: BrokersFilterState = {
  search: '',
  project: '',
  transactionType: 'all',
  bhk: '',
  freshness: 'all',
  broker: '',
  group: '',
  furnishing: 'all',
  sort: 'lastSeenAt',
  sortDir: 'desc',
};

type TabId = 'inventory' | 'review' | 'directory' | 'projects' | 'imports' | 'analytics';

const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'inventory', label: 'Inventory' },
  { id: 'review', label: 'Review queue' },
  { id: 'directory', label: 'Brokers' },
  { id: 'projects', label: 'Projects' },
  { id: 'imports', label: 'Import history' },
  { id: 'analytics', label: 'Analytics' },
];

export default function BrokersWorkspace() {
  const [tab, setTab] = useState<TabId>('inventory');
  const [filters, setFilters] = useState<BrokersFilterState>(DEFAULT_FILTERS);
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebouncedValue(filters.search, 300);
  const [items, setItems] = useState<BrokerInventoryQueueItem[]>([]);
  const [metrics, setMetrics] = useState<BrokerWorkspaceMetrics | null>(null);
  const [filterOptions, setFilterOptions] = useState<{
    projects: string[];
    brokers: string[];
    groups: string[];
  }>({ projects: [], brokers: [], groups: [] });
  const [pagination, setPagination] = useState({ page: 1, pageSize: 25, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [refreshingFreshness, setRefreshingFreshness] = useState(false);

  const loadWorkspace = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: '25',
        sort: filters.sort,
        sortDir: filters.sortDir,
      });
      if (debouncedSearch.trim()) params.set('search', debouncedSearch.trim());
      if (filters.project) params.set('project', filters.project);
      if (filters.transactionType !== 'all') params.set('transactionType', filters.transactionType);
      if (filters.bhk.trim()) params.set('bhk', filters.bhk.trim());
      if (filters.freshness !== 'all') params.set('freshness', filters.freshness);
      if (filters.broker) params.set('broker', filters.broker);
      if (filters.group) params.set('group', filters.group);
      if (filters.furnishing !== 'all') params.set('furnishing', filters.furnishing);

      const res = await fetch(`/api/ops/brokers/queue?${params.toString()}`, {
        credentials: 'include',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Unable to load broker inventory.');
        return;
      }
      setItems(data.items || []);
      setMetrics(data.metrics || null);
      setPagination(data.pagination || { page: 1, pageSize: 25, total: 0, totalPages: 1 });
      setFilterOptions(data.filterOptions || { projects: [], brokers: [], groups: [] });
    } catch {
      setError('Unable to load broker inventory.');
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, filters, page]);

  useEffect(() => {
    if (tab === 'inventory') loadWorkspace();
  }, [loadWorkspace, tab]);

  useEffect(() => {
    setPage(1);
  }, [
    debouncedSearch,
    filters.project,
    filters.transactionType,
    filters.bhk,
    filters.freshness,
    filters.broker,
    filters.group,
    filters.furnishing,
  ]);

  async function recalculateFreshness() {
    setRefreshingFreshness(true);
    setError('');
    try {
      const res = await fetch('/api/ops/brokers/freshness', {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Unable to refresh freshness.');
        return;
      }
      await loadWorkspace();
    } catch {
      setError('Unable to refresh freshness.');
    } finally {
      setRefreshingFreshness(false);
    }
  }

  function openDrawer(item: BrokerInventoryQueueItem) {
    setSelectedId(item.id);
    setDrawerOpen(true);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1 rounded-lg border border-slate-200 bg-white p-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                tab === t.id
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              {t.label}
              {t.id === 'review' && metrics?.pendingReviews
                ? ` (${metrics.pendingReviews})`
                : ''}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {tab === 'inventory' ? (
            <Button
              variant="outline"
              onClick={recalculateFreshness}
              disabled={refreshingFreshness}
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${refreshingFreshness ? 'animate-spin' : ''}`} />
              Refresh freshness
            </Button>
          ) : null}
          <Button onClick={() => setImportOpen(true)}>
            <Upload className="mr-2 h-4 w-4" />
            Import WhatsApp export
          </Button>
        </div>
      </div>

      {metrics ? <BrokersKpiHeader metrics={metrics} /> : null}

      {tab === 'inventory' ? (
        <>
          <BrokersFilters
            filters={filters}
            onChange={setFilters}
            filterOptions={filterOptions}
          />

          {error ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          ) : null}

          <BrokersQueueTable items={items} loading={loading} onSelect={openDrawer} />

          <div className="flex items-center justify-between text-sm text-slate-600">
            <span>
              Page {pagination.page} of {pagination.totalPages} · {pagination.total} listings
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1 || loading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= pagination.totalPages || loading}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </>
      ) : null}

      {tab === 'review' ? <BrokerReviewPanel /> : null}
      {tab === 'directory' ? <BrokerDirectoryPanel /> : null}
      {tab === 'projects' ? <BrokerProjectsPanel /> : null}
      {tab === 'imports' ? <BrokerImportsPanel /> : null}
      {tab === 'analytics' ? <BrokerAnalyticsPanel /> : null}

      <BrokerInventoryDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        inventoryId={selectedId}
      />

      <BrokerImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onImported={() => {
          loadWorkspace();
        }}
        onViewInventory={() => {
          setTab('inventory');
          loadWorkspace();
        }}
        onViewReview={() => {
          setTab('review');
          loadWorkspace();
        }}
      />
    </div>
  );
}
