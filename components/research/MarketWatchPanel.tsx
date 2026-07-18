'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Activity, Bell, Eye, Gauge, RefreshCw } from 'lucide-react';
import { DEFAULT_RESEARCH_WORKSPACE } from '@/lib/research/business';
import type { MarketWatchDashboard } from '@/lib/research/monitoring/types';

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-xl font-black text-slate-900 dark:text-slate-100">{value}</p>
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

export default function MarketWatchPanel() {
  const [dashboard, setDashboard] = useState<MarketWatchDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/research/monitoring/dashboard?workspaceId=${encodeURIComponent(DEFAULT_RESEARCH_WORKSPACE.id)}`,
        { credentials: 'include' },
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load market watch');
      setDashboard(json.dashboard);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load market watch');
    }
  }, []);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 20_000);
    return () => clearInterval(t);
  }, [load]);

  const runTick = async () => {
    setBusy(true);
    try {
      const res = await fetch('/api/research/scheduler/tick', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enqueueLimit: 10, processLimit: 1 }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Tick failed');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tick failed');
    } finally {
      setBusy(false);
    }
  };

  if (error && !dashboard) {
    return (
      <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
        {error}
      </p>
    );
  }

  if (!dashboard) {
    return <p className="text-sm text-slate-500">Loading market watch…</p>;
  }

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Live market watch
          </h2>
          <p className="text-xs text-slate-500">
            Autonomous monitoring — watches, queue, alerts, workers, and KG growth
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/research/operations"
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          >
            <Gauge className="h-3.5 w-3.5" />
            Operations
          </Link>
          <Link
            href="/research/watches"
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          >
            <Eye className="h-3.5 w-3.5" />
            Watches
          </Link>
          <Link
            href="/research/notifications"
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          >
            <Bell className="h-3.5 w-3.5" />
            Alerts
          </Link>
          <button
            type="button"
            onClick={() => void runTick()}
            disabled={busy}
            className="inline-flex h-8 items-center gap-1.5 rounded-md bg-slate-900 px-3 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${busy ? 'animate-spin' : ''}`} />
            Run tick
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Active watches" value={dashboard.activeWatches} />
        <Stat label="Queued jobs" value={dashboard.jobsQueued ?? dashboard.scheduledJobs} />
        <Stat label="Running jobs" value={dashboard.jobsRunning} />
        <Stat label="Completed jobs" value={dashboard.jobsCompleted ?? 0} />
        <Stat label="Failed jobs" value={dashboard.jobsFailed} />
        <Stat label="Alerts today" value={dashboard.alertsToday} />
        <Stat label="Price drops" value={dashboard.priceDrops} hint="Today" />
        <Stat label="New inventory" value={dashboard.newListings} hint="Today" />
        <Stat label="Removed inventory" value={dashboard.removedListings} hint="Today" />
        <Stat label="Inventory changes" value={dashboard.inventoryChanges} hint="Today" />
        <Stat
          label="Market movement"
          value={
            dashboard.marketMovementPct == null
              ? '—'
              : `${dashboard.marketMovementPct > 0 ? '+' : ''}${dashboard.marketMovementPct}%`
          }
        />
        <Stat label="KG growth (7d)" value={dashboard.knowledgeGraphGrowth} />
        <Stat label="Research queue" value={dashboard.researchQueueDepth ?? 0} />
        <Stat label="System health" value={dashboard.systemHealth || 'unknown'} />
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-2 flex items-center gap-2">
            <Activity className="h-3.5 w-3.5 text-orange-600" />
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Connector health
            </p>
          </div>
          <ul className="space-y-1.5">
            {dashboard.connectorHealth.map((c) => (
              <li
                key={c.portal}
                className="flex items-center justify-between text-sm text-slate-700 dark:text-slate-300"
              >
                <span className="capitalize">{c.portal}</span>
                <span
                  className={
                    c.status === 'connected' ? 'text-emerald-600' : 'text-slate-400'
                  }
                >
                  {c.status}
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Background workers
          </p>
          <ul className="space-y-1.5 text-sm">
            {(dashboard.backgroundWorkers || []).map((w) => (
              <li key={w.workerType} className="flex justify-between">
                <span>{w.workerType}</span>
                <span
                  className={
                    w.status === 'online'
                      ? 'text-emerald-600'
                      : w.status === 'stale'
                        ? 'text-amber-600'
                        : 'text-slate-400'
                  }
                >
                  {w.status}
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Proactive insights
          </p>
          {dashboard.recentInsights.length === 0 ? (
            <p className="text-sm text-slate-500">
              Insights appear after watch jobs accumulate observation history.
            </p>
          ) : (
            <ul className="space-y-2">
              {dashboard.recentInsights.slice(0, 5).map((insight) => (
                <li
                  key={insight}
                  className="border-l-2 border-orange-400 pl-2 text-sm text-slate-700 dark:text-slate-300"
                >
                  {insight}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      {error ? <p className="text-xs text-rose-600">{error}</p> : null}
    </section>
  );
}
