'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Archive, Bell, CheckCheck, Search } from 'lucide-react';
import { DEFAULT_RESEARCH_WORKSPACE } from '@/lib/research/business';
import type {
  AlertCategory,
  AlertSeverity,
  ResearchNotification,
} from '@/lib/research/monitoring/types';

const CATEGORIES: Array<AlertCategory | 'all'> = [
  'all',
  'new_listing',
  'listing_removed',
  'price_drop',
  'price_increase',
  'inventory_up',
  'inventory_down',
  'broker_change',
  'relisted',
  'stale_listing',
  'project_momentum',
  'insight',
];

function severityClass(severity: AlertSeverity) {
  if (severity === 'critical' || severity === 'high') return 'bg-rose-100 text-rose-800';
  if (severity === 'medium') return 'bg-amber-100 text-amber-800';
  return 'bg-slate-100 text-slate-700';
}

export default function NotificationsCenter() {
  const [notifications, setNotifications] = useState<ResearchNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [readFilter, setReadFilter] = useState<'all' | 'unread' | 'read'>('all');
  const [archivedFilter, setArchivedFilter] = useState<'active' | 'archived'>('active');
  const [category, setCategory] = useState<AlertCategory | 'all'>('all');
  const [selected, setSelected] = useState<ResearchNotification | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        workspaceId: DEFAULT_RESEARCH_WORKSPACE.id,
        limit: '100',
        archived: archivedFilter === 'archived' ? 'true' : 'false',
      });
      if (readFilter === 'unread') params.set('read', 'false');
      if (readFilter === 'read') params.set('read', 'true');
      if (category !== 'all') params.set('category', category);
      if (q.trim()) params.set('q', q.trim());
      const res = await fetch(`/api/research/notifications?${params}`, {
        credentials: 'include',
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load notifications');
      setNotifications(json.notifications || []);
      setUnread(json.unread || 0);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load notifications');
    }
  }, [archivedFilter, category, q, readFilter]);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 30_000);
    return () => clearInterval(t);
  }, [load]);

  const patchOne = async (n: ResearchNotification, body: Record<string, unknown>) => {
    setSelected(n);
    const res = await fetch(`/api/research/notifications/${n.id}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workspaceId: DEFAULT_RESEARCH_WORKSPACE.id,
        ...body,
      }),
    });
    if (res.ok) await load();
  };

  const bulk = async (action: 'read' | 'archive' | 'unread' | 'unarchive') => {
    const ids = Array.from(checked);
    if (!ids.length) return;
    const res = await fetch('/api/research/notifications', {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workspaceId: DEFAULT_RESEARCH_WORKSPACE.id,
        ids,
        action,
      }),
    });
    if (res.ok) {
      setChecked(new Set());
      await load();
    }
  };

  const filteredHint = useMemo(
    () => `${notifications.length} shown · ${unread} unread`,
    [notifications.length, unread],
  );

  const entityHref = (n: ResearchNotification) => {
    if (n.propertyId) return `/research/knowledge?entity=property&id=${n.propertyId}`;
    if (n.projectId) return `/research/knowledge?entity=project&id=${n.projectId}`;
    if (n.brokerId) return `/research/knowledge?entity=broker&id=${n.brokerId}`;
    return null;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search alerts…"
            className="h-9 w-full rounded-md border border-slate-200 bg-white pl-8 pr-3 text-sm dark:border-slate-700 dark:bg-slate-950"
          />
        </div>
        <select
          value={readFilter}
          onChange={(e) => setReadFilter(e.target.value as typeof readFilter)}
          className="h-9 rounded-md border border-slate-200 bg-white px-2 text-sm dark:border-slate-700 dark:bg-slate-950"
        >
          <option value="all">All</option>
          <option value="unread">Unread</option>
          <option value="read">Read</option>
        </select>
        <select
          value={archivedFilter}
          onChange={(e) => setArchivedFilter(e.target.value as typeof archivedFilter)}
          className="h-9 rounded-md border border-slate-200 bg-white px-2 text-sm dark:border-slate-700 dark:bg-slate-950"
        >
          <option value="active">Inbox</option>
          <option value="archived">Archived</option>
        </select>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as AlertCategory | 'all')}
          className="h-9 rounded-md border border-slate-200 bg-white px-2 text-sm dark:border-slate-700 dark:bg-slate-950"
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <p className="text-xs text-slate-500">{filteredHint}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void bulk('read')}
          disabled={!checked.size}
          className="inline-flex h-8 items-center gap-1 rounded-md border border-slate-200 px-2 text-xs disabled:opacity-50"
        >
          <CheckCheck className="h-3.5 w-3.5" />
          Mark read
        </button>
        <button
          type="button"
          onClick={() => void bulk('archive')}
          disabled={!checked.size}
          className="inline-flex h-8 items-center gap-1 rounded-md border border-slate-200 px-2 text-xs disabled:opacity-50"
        >
          <Archive className="h-3.5 w-3.5" />
          Archive
        </button>
      </div>

      {error ? (
        <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error}
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
          {notifications.length === 0 ? (
            <li className="flex items-center gap-2 px-4 py-10 text-sm text-slate-500">
              <Bell className="h-4 w-4" />
              No notifications yet. Alerts appear when watches detect market changes.
            </li>
          ) : (
            notifications.map((n) => (
              <li key={n.id} className="flex items-start gap-2 px-3 py-2">
                <input
                  type="checkbox"
                  className="mt-2"
                  checked={checked.has(n.id)}
                  onChange={(e) => {
                    setChecked((prev) => {
                      const next = new Set(prev);
                      if (e.target.checked) next.add(n.id);
                      else next.delete(n.id);
                      return next;
                    });
                  }}
                />
                <button
                  type="button"
                  onClick={() => void patchOne(n, { read: true })}
                  className={`flex min-w-0 flex-1 flex-col gap-1 rounded-md px-2 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800/60 ${
                    !n.read ? 'bg-orange-50/40 dark:bg-orange-950/20' : ''
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${severityClass(n.severity)}`}
                    >
                      {n.severity}
                    </span>
                    <span className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
                      {n.priority || 'normal'} · {n.category}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      {new Date(n.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {n.title}
                  </p>
                  <p className="line-clamp-2 text-xs text-slate-500">{n.body}</p>
                </button>
              </li>
            ))
          )}
        </ul>

        <aside className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Evidence & timeline
          </h2>
          {!selected ? (
            <p className="mt-2 text-sm text-slate-500">Select an alert to inspect evidence.</p>
          ) : (
            <div className="mt-3 space-y-3 text-sm">
              <p className="font-medium text-slate-900 dark:text-slate-100">{selected.title}</p>
              <p className="text-slate-600 dark:text-slate-300">{selected.body}</p>
              {entityHref(selected) ? (
                <Link
                  href={entityHref(selected)!}
                  className="text-xs font-medium text-orange-700 hover:underline"
                >
                  Open related entity →
                </Link>
              ) : null}
              <button
                type="button"
                onClick={() => void patchOne(selected, { archived: true })}
                className="inline-flex h-8 items-center gap-1 rounded-md border border-slate-200 px-2 text-xs"
              >
                <Archive className="h-3.5 w-3.5" />
                Archive
              </button>
              <dl className="space-y-1 text-xs text-slate-500">
                {selected.propertyId ? (
                  <div>
                    <dt className="inline font-semibold">Property: </dt>
                    <dd className="inline font-mono">{selected.propertyId}</dd>
                  </div>
                ) : null}
                {selected.projectId ? (
                  <div>
                    <dt className="inline font-semibold">Project: </dt>
                    <dd className="inline font-mono">{selected.projectId}</dd>
                  </div>
                ) : null}
                {selected.brokerId ? (
                  <div>
                    <dt className="inline font-semibold">Broker: </dt>
                    <dd className="inline font-mono">{selected.brokerId}</dd>
                  </div>
                ) : null}
              </dl>
              {Array.isArray((selected.evidence as { timeline?: unknown[] }).timeline) ? (
                <ul className="space-y-1 border-l border-slate-200 pl-3 text-xs text-slate-600">
                  {((selected.evidence as { timeline: Array<{ at?: string; event?: string }> })
                    .timeline || []).map((t, i) => (
                    <li key={`${t.at}-${i}`}>
                      <span className="font-medium">{t.event}</span>
                      {t.at ? ` · ${new Date(t.at).toLocaleString()}` : ''}
                    </li>
                  ))}
                </ul>
              ) : null}
              <pre className="max-h-64 overflow-auto rounded-md bg-slate-50 p-2 text-[11px] text-slate-700 dark:bg-slate-950 dark:text-slate-300">
                {JSON.stringify(selected.evidence, null, 2)}
              </pre>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
