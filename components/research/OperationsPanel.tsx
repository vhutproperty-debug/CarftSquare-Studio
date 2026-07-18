'use client';

import { useCallback, useEffect, useState } from 'react';
import { DEFAULT_RESEARCH_WORKSPACE } from '@/lib/research/business';
import type { SystemHealthReport } from '@/lib/research/monitoring/types';

export default function OperationsPanel() {
  const [health, setHealth] = useState<SystemHealthReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/research/system-health?workspaceId=${encodeURIComponent(DEFAULT_RESEARCH_WORKSPACE.id)}`,
        { credentials: 'include' },
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load system health');
      setHealth(json.health);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    }
  }, []);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 20_000);
    return () => clearInterval(t);
  }, [load]);

  if (error && !health) {
    return (
      <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
        {error}
      </p>
    );
  }

  if (!health) return <p className="text-sm text-slate-500">Loading operations…</p>;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              System health
            </h2>
            <p className="text-xs text-slate-500">
              Checked {new Date(health.checkedAt).toLocaleString()}
            </p>
          </div>
          <span
            className={`rounded-md px-2 py-1 text-xs font-semibold uppercase ${
              health.status === 'healthy'
                ? 'bg-emerald-100 text-emerald-800'
                : health.status === 'degraded'
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-rose-100 text-rose-800'
            }`}
          >
            {health.status}
          </span>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Metric label="Job success (24h)" value={fmtPct(health.jobSuccessRate24h)} />
          <Metric label="Portal failures (24h)" value={fmtPct(health.portalFailureRate24h)} />
          <Metric label="Retries (24h)" value={health.retryCount24h} />
          <Metric label="Alert throughput (24h)" value={health.alertThroughput24h} />
          <Metric label="KG updates (24h)" value={health.kgUpdateRate24h} />
          <Metric label="Browser crashes (24h)" value={health.browserCrashCount24h} />
          <Metric
            label="Avg connector latency"
            value={
              health.avgConnectorLatencyMs == null ? '—' : `${health.avgConnectorLatencyMs} ms`
            }
          />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Background workers
          </h3>
          <ul className="mt-3 space-y-2">
            {health.workers.length === 0 ? (
              <li className="text-sm text-slate-500">
                No worker heartbeats yet. Run{' '}
                <code className="rounded bg-slate-100 px-1 text-xs">npm run research:monitor</code>{' '}
                outside the web process.
              </li>
            ) : (
              health.workers.map((w) => (
                <li
                  key={`${w.workerType}-${w.workerId}`}
                  className="flex items-center justify-between text-sm"
                >
                  <span>
                    <span className="font-medium">{w.workerType}</span>
                    <span className="ml-2 text-xs text-slate-400">{w.workerId}</span>
                  </span>
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
              ))
            )}
          </ul>
        </section>
        <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Connector status
          </h3>
          <ul className="mt-3 space-y-2">
            {health.connectors.map((c) => (
              <li key={c.portal} className="flex justify-between text-sm capitalize">
                <span>{c.portal}</span>
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
        </section>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-slate-100 p-3 dark:border-slate-800">
      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-lg font-black text-slate-900 dark:text-slate-100">{value}</p>
    </div>
  );
}

function fmtPct(n: number | null) {
  return n == null ? '—' : `${n}%`;
}
