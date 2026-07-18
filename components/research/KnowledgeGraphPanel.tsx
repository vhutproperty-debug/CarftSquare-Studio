'use client';

import { useEffect, useState } from 'react';
import { DEFAULT_RESEARCH_WORKSPACE } from '@/lib/research/business';
import type { KgDashboardStats } from '@/lib/research/graph/types';

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-xl font-black text-slate-900 dark:text-slate-100">{value}</p>
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

export default function KnowledgeGraphPanel() {
  const [stats, setStats] = useState<KgDashboardStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(
          `/api/research/graph/stats?workspaceId=${encodeURIComponent(DEFAULT_RESEARCH_WORKSPACE.id)}`,
          { credentials: 'include' },
        );
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed');
        if (!cancelled) setStats(json.stats);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed');
      }
    };
    void load();
    const t = setInterval(() => void load(), 20_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  if (error) {
    return (
      <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
        {error}
      </p>
    );
  }

  if (!stats) {
    return <p className="text-sm text-slate-500">Loading knowledge graph…</p>;
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          Property knowledge graph
        </h2>
        <p className="text-xs text-slate-500">Built only from collected research data</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <Stat label="Canonical properties" value={stats.totalProperties} />
        <Stat label="Tracked projects" value={stats.trackedProjects} />
        <Stat label="Tracked brokers" value={stats.trackedBrokers} />
        <Stat label="Historical observations" value={stats.historicalObservations} />
        <Stat label="Price drops (7d)" value={stats.priceDropsDetected} />
        <Stat label="New listings (7d)" value={stats.newListings} />
        <Stat label="Removed listings (7d)" value={stats.removedListings} />
        <Stat
          label="Avg market movement"
          value={
            stats.averageMarketMovementPct == null
              ? '—'
              : `${stats.averageMarketMovementPct > 0 ? '+' : ''}${stats.averageMarketMovementPct}%`
          }
          hint="From observed price changes only"
        />
        <Stat label="Graph growth (7d)" value={stats.knowledgeGraphGrowth7d} />
      </div>
    </section>
  );
}
