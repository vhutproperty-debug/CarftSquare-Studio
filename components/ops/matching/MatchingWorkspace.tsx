'use client';

import { useCallback, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import MatchingDrawer from '@/components/ops/matching/MatchingDrawer';
import MatchFilters, { type MatchFilterState } from '@/components/ops/matching/MatchFilters';
import MatchKpiHeader from '@/components/ops/matching/MatchKpiHeader';
import MatchingQueue from '@/components/ops/matching/MatchingQueue';
import type { MatchQueueItem, MatchingWorkspaceMetrics } from '@/lib/ops/matching/types';

function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

const DEFAULT_FILTERS: MatchFilterState = {
  search: '',
  project: '',
  broker: '',
  configuration: '',
  listingType: 'all',
  minScore: '',
  status: 'all',
  assignedBroker: 'all',
  dateFrom: '',
  dateTo: '',
  mineOnly: false,
};

export default function MatchingWorkspace() {
  const [filters, setFilters] = useState<MatchFilterState>(DEFAULT_FILTERS);
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebouncedValue(filters.search, 300);
  const [items, setItems] = useState<MatchQueueItem[]>([]);
  const [metrics, setMetrics] = useState<MatchingWorkspaceMetrics | null>(null);
  const [team, setTeam] = useState<Array<{ id: string; name: string; email: string }>>([]);
  const [currentUserId, setCurrentUserId] = useState<string | undefined>();
  const [pagination, setPagination] = useState({ page: 1, pageSize: 25, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [generateResult, setGenerateResult] = useState('');
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
      if (filters.project.trim()) params.set('project', filters.project.trim());
      if (filters.configuration.trim()) params.set('configuration', filters.configuration.trim());
      if (filters.listingType !== 'all') params.set('listingType', filters.listingType);
      if (filters.minScore.trim()) params.set('minScore', filters.minScore.trim());
      if (filters.assignedBroker !== 'all') params.set('assignedBroker', filters.assignedBroker);
      if (filters.dateFrom) params.set('dateFrom', new Date(filters.dateFrom).toISOString());
      if (filters.mineOnly) params.set('mineOnly', 'true');

      const [queueRes, teamRes, authRes] = await Promise.all([
        fetch(`/api/ops/matching/queue?${params.toString()}`, { credentials: 'include' }),
        fetch('/api/ops/team', { credentials: 'include' }),
        fetch('/api/auth/status', { credentials: 'include' }),
      ]);

      const queueData = await queueRes.json().catch(() => ({}));
      if (!queueRes.ok) {
        setError(queueData.error || 'Unable to load matching workspace.');
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
      setError('Unable to load matching workspace.');
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, filters, page]);

  useEffect(() => {
    loadWorkspace();
  }, [loadWorkspace]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, filters.status, filters.project, filters.configuration, filters.listingType, filters.minScore, filters.assignedBroker, filters.mineOnly]);

  async function generateMatches() {
    setGenerating(true);
    setGenerateResult('');
    try {
      const minScore = filters.minScore.trim() ? Number(filters.minScore) : 35;
      const res = await fetch('/api/ops/matching/generate', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ minScore }),
      });
      const data = await res.json();
      if (res.ok) {
        setGenerateResult(`Created ${data.created}, updated ${data.updated}, skipped ${data.skipped} (${data.totalPairsEvaluated} pairs evaluated).`);
        await loadWorkspace();
      } else {
        setGenerateResult('Generation failed.');
      }
    } finally {
      setGenerating(false);
    }
  }

  function openDrawer(item: MatchQueueItem) {
    setSelectedId(item.id);
    setDrawerOpen(true);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-600">
          Deterministic matching between demand ready for matching and available supply inventory.
        </p>
        <Button onClick={generateMatches} disabled={generating}>
          <RefreshCw className={`mr-2 h-4 w-4 ${generating ? 'animate-spin' : ''}`} />
          Generate matches
        </Button>
      </div>

      {generateResult ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-900">
          {generateResult}
        </div>
      ) : null}

      {metrics ? <MatchKpiHeader metrics={metrics} /> : null}

      <MatchFilters
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
          Loading matches…
        </div>
      ) : (
        <MatchingQueue items={items} selectedId={selectedId} onSelect={openDrawer} />
      )}

      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-600">
          Page {pagination.page} of {pagination.totalPages} · {pagination.total} matches
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

      <MatchingDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        matchId={selectedId}
        currentUserId={currentUserId}
        onUpdated={loadWorkspace}
      />
    </div>
  );
}
