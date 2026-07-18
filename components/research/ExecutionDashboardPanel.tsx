'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { DEFAULT_RESEARCH_WORKSPACE } from '@/lib/research/business';

type DashboardPayload = {
  stats: {
    researchRuns: number;
    connectedPortals: number;
    recentSearches: number;
    savedSearches: number;
    todaysActivity: number;
    aiSessions: number;
  };
  activeSession: null | {
    id: string;
    title: string;
    status: string;
    progress: {
      phase: string;
      percent: number;
      message: string;
      portalsTotal: number;
      portalsDone: number;
      listingsCollected: number;
      duplicatesRemoved: number;
      estimatedCompletionAt?: string;
    };
    listingsCollected: number;
    duplicatesRemoved: number;
    confidence?: number;
    reasoningSummary?: string;
    reportReady: boolean;
  };
  recentSessions: Array<{
    id: string;
    title: string;
    status: string;
    progress: { phase: string; percent: number; message: string };
    confidence?: number;
    updatedAt: string;
  }>;
};

export default function ExecutionDashboardPanel({
  onStats,
}: {
  onStats?: (stats: DashboardPayload['stats']) => void;
}) {
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(
          `/api/research/ai/dashboard?workspaceId=${encodeURIComponent(DEFAULT_RESEARCH_WORKSPACE.id)}`,
          { credentials: 'include' },
        );
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed');
        if (!cancelled) {
          setData(json);
          onStats?.(json.stats);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed');
      }
    };
    void load();
    const t = setInterval(() => void load(), 8000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [onStats]);

  if (error) {
    return (
      <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
        {error}
      </p>
    );
  }

  if (!data) {
    return <p className="text-sm text-slate-500">Loading execution status…</p>;
  }

  const active = data.activeSession;

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            AI execution
          </h2>
          <Link
            href="/research/research"
            className="text-xs font-medium text-slate-600 underline hover:text-slate-900 dark:text-slate-300"
          >
            Open analyst
          </Link>
        </div>
        {!active ? (
          <p className="mt-3 text-sm text-slate-500">No AI research sessions yet.</p>
        ) : (
          <>
            <p className="mt-2 text-sm font-medium text-slate-800 dark:text-slate-100">
              {active.title}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {active.progress.message} · {active.progress.phase} · {active.progress.percent}%
            </p>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <div
                className="h-full rounded-full bg-orange-500"
                style={{ width: `${active.progress.percent}%` }}
              />
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
              <div>
                <dt className="uppercase tracking-wide text-slate-400">Connectors</dt>
                <dd>
                  {active.progress.portalsDone}/{active.progress.portalsTotal}
                </dd>
              </div>
              <div>
                <dt className="uppercase tracking-wide text-slate-400">Listings</dt>
                <dd>{active.listingsCollected}</dd>
              </div>
              <div>
                <dt className="uppercase tracking-wide text-slate-400">Duplicates</dt>
                <dd>{active.duplicatesRemoved}</dd>
              </div>
              <div>
                <dt className="uppercase tracking-wide text-slate-400">Confidence</dt>
                <dd>{active.confidence ?? '—'}</dd>
              </div>
            </dl>
            {active.reasoningSummary ? (
              <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
                {active.reasoningSummary}
              </p>
            ) : null}
            <p className="mt-2 text-xs text-slate-500">
              Report: {active.reportReady ? 'ready' : 'pending'}
              {active.progress.estimatedCompletionAt
                ? ` · ETA ${new Date(active.progress.estimatedCompletionAt).toLocaleTimeString()}`
                : ''}
            </p>
          </>
        )}
      </section>

      {data.recentSessions.length > 0 ? (
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Recent AI sessions
          </h2>
          <ul className="mt-3 space-y-2 text-sm">
            {data.recentSessions.map((s) => (
              <li
                key={s.id}
                className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2 last:border-0 dark:border-slate-800"
              >
                <div>
                  <p className="font-medium text-slate-800 dark:text-slate-100">{s.title}</p>
                  <p className="text-xs text-slate-500">
                    {s.status} · {s.progress.percent}% · confidence {s.confidence ?? '—'}
                  </p>
                </div>
                <Link
                  href="/research/research"
                  className="text-xs font-medium text-slate-600 underline"
                >
                  Continue
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
