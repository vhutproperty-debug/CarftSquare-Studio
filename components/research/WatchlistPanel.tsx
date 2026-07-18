'use client';

import { useCallback, useEffect, useState } from 'react';
import { Pause, Play, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { DEFAULT_RESEARCH_WORKSPACE } from '@/lib/research/business';
import type {
  ResearchWatch,
  WatchFrequency,
  WatchPriority,
  WatchScope,
} from '@/lib/research/monitoring/types';

const SCOPES: WatchScope[] = [
  'project',
  'building',
  'tower',
  'property',
  'broker',
  'builder',
  'locality',
  'landmark',
  'polygon',
  'saved_search',
  'custom_query',
];

const FREQUENCIES: WatchFrequency[] = [
  'hourly',
  'daily',
  'weekly',
  'monthly',
  'manual',
  'event',
];
const PRIORITIES: WatchPriority[] = ['low', 'normal', 'high', 'critical'];

export default function WatchlistPanel() {
  const [watches, setWatches] = useState<ResearchWatch[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [scope, setScope] = useState<WatchScope>('custom_query');
  const [frequency, setFrequency] = useState<WatchFrequency>('daily');
  const [priority, setPriority] = useState<WatchPriority>('normal');
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/research/watches?workspaceId=${encodeURIComponent(DEFAULT_RESEARCH_WORKSPACE.id)}`,
        { credentials: 'include' },
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load watches');
      setWatches(json.watches || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load watches');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const create = async () => {
    if (!name.trim()) return;
    setCreating(true);
    try {
      const res = await fetch('/api/research/watches', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId: DEFAULT_RESEARCH_WORKSPACE.id,
          name: name.trim(),
          naturalLanguage: name.trim(),
          scope,
          frequency,
          priority,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Create failed');
      setName('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create failed');
    } finally {
      setCreating(false);
    }
  };

  const patch = async (id: string, body: Record<string, unknown>) => {
    setBusyId(id);
    try {
      const res = await fetch(`/api/research/watches/${id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Update failed');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (id: string) => {
    setBusyId(id);
    try {
      const res = await fetch(
        `/api/research/watches/${id}?workspaceId=${encodeURIComponent(DEFAULT_RESEARCH_WORKSPACE.id)}`,
        { method: 'DELETE', credentials: 'include' },
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Delete failed');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          Create watch
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          Monitor projects, localities, brokers, or custom queries on a schedule.
        </p>
        <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Oberoi Sky City / 2 BHK under ₹80,000"
            className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950 md:col-span-2"
          />
          <select
            value={scope}
            onChange={(e) => setScope(e.target.value as WatchScope)}
            className="h-9 rounded-md border border-slate-200 bg-white px-2 text-sm dark:border-slate-700 dark:bg-slate-950"
          >
            {SCOPES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <select
            value={frequency}
            onChange={(e) => setFrequency(e.target.value as WatchFrequency)}
            className="h-9 rounded-md border border-slate-200 bg-white px-2 text-sm dark:border-slate-700 dark:bg-slate-950"
          >
            {FREQUENCIES.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value as WatchPriority)}
            className="h-9 rounded-md border border-slate-200 bg-white px-2 text-sm dark:border-slate-700 dark:bg-slate-950"
          >
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => void create()}
            disabled={creating || !name.trim()}
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md bg-slate-900 px-3 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900"
          >
            <Plus className="h-3.5 w-3.5" />
            Add watch
          </button>
        </div>
      </section>

      {error ? (
        <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error}
        </p>
      ) : null}

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="border-b border-slate-100 px-4 py-3 dark:border-slate-800">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Active watches ({watches.length})
          </h2>
        </div>
        {watches.length === 0 ? (
          <p className="px-4 py-8 text-sm text-slate-500">
            No watches yet. Add a project, locality, or search query to start continuous monitoring.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {watches.map((w) => (
              <li key={w.id} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {w.name}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {w.scope} · {w.frequency} · {w.priority} · {w.status}
                    {w.health ? ` · health ${w.health}` : ''}
                    {w.enabled === false ? ' · disabled' : ''}
                    {w.lastRunAt ? ` · last ${new Date(w.lastRunAt).toLocaleString()}` : ''}
                    {w.nextRunAt ? ` · next ${new Date(w.nextRunAt).toLocaleString()}` : ''}
                    {w.lastChangeDetectedAt
                      ? ` · change ${new Date(w.lastChangeDetectedAt).toLocaleString()}`
                      : ''}
                  </p>
                  {w.lastError ? (
                    <p className="mt-1 text-xs text-rose-600">{w.lastError}</p>
                  ) : null}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    title="Run now"
                    disabled={busyId === w.id}
                    onClick={() => void patch(w.id, { action: 'run_now' })}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    title={w.status === 'paused' ? 'Resume' : 'Pause'}
                    disabled={busyId === w.id}
                    onClick={() =>
                      void patch(w.id, {
                        status: w.status === 'paused' ? 'active' : 'paused',
                      })
                    }
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700"
                  >
                    {w.status === 'paused' ? (
                      <Play className="h-3.5 w-3.5" />
                    ) : (
                      <Pause className="h-3.5 w-3.5" />
                    )}
                  </button>
                  <button
                    type="button"
                    title="Delete"
                    disabled={busyId === w.id}
                    onClick={() => void remove(w.id)}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-rose-600 hover:bg-rose-50 dark:border-slate-700"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
