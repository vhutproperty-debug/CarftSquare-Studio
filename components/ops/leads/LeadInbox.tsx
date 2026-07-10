'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import LeadFilters, { type LeadFilterState } from '@/components/ops/leads/LeadFilters';
import { LeadMobileList } from '@/components/ops/leads/LeadMobileCard';
import LeadTable from '@/components/ops/leads/LeadTable';
import type { NormalizedOpsLead, OpsLeadSourceHealth } from '@/lib/ops/leads/types';

type LeadInboxProps = {
  initialPage?: number;
};

export default function LeadInbox({ initialPage = 1 }: LeadInboxProps) {
  const [filters, setFilters] = useState<LeadFilterState>({
    search: '',
    source: 'all',
    category: 'all',
  });
  const [page, setPage] = useState(initialPage);
  const [leads, setLeads] = useState<NormalizedOpsLead[]>([]);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 25, total: 0, totalPages: 1 });
  const [sourceHealth, setSourceHealth] = useState<Partial<OpsLeadSourceHealth>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadLeads = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: '25',
      });
      if (filters.search.trim()) params.set('search', filters.search.trim());
      if (filters.source !== 'all') params.set('source', filters.source);
      if (filters.category !== 'all') params.set('category', filters.category);

      const response = await fetch(`/api/ops/leads?${params.toString()}`, { credentials: 'include' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error || 'Unable to load leads.');
        return;
      }
      setLeads(data.items || []);
      setPagination(data.pagination || { page: 1, pageSize: 25, total: 0, totalPages: 1 });
      setSourceHealth(data.sourceHealth || {});
    } catch {
      setError('Unable to load leads.');
    } finally {
      setLoading(false);
    }
  }, [filters, page]);

  useEffect(() => {
    loadLeads();
  }, [loadLeads]);

  useEffect(() => {
    setPage(1);
  }, [filters.search, filters.source, filters.category]);

  const erroredSources = Object.entries(sourceHealth)
    .filter(([, status]) => status === 'error')
    .map(([source]) => source);

  return (
    <div className="space-y-4">
      <LeadFilters filters={filters} onChange={setFilters} />

      {erroredSources.length ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Some lead sources could not be loaded ({erroredSources.join(', ')}). Remaining sources are shown.
        </div>
      ) : null}

      {error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white px-6 py-12 text-center text-sm text-slate-500">
          Loading leads…
        </div>
      ) : (
        <>
          <LeadTable leads={leads} />
          <LeadMobileList leads={leads} />
        </>
      )}

      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-600">
          Page {pagination.page} of {pagination.totalPages} · {pagination.total} leads
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={loading || pagination.page <= 1}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={loading || pagination.page >= pagination.totalPages}
            onClick={() => setPage((current) => current + 1)}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
