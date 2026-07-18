'use client';

import { useCallback, useEffect, useState } from 'react';
import { DEFAULT_RESEARCH_WORKSPACE } from '@/lib/research/business';
import type { ResearchBrowserSession, ResearchPortalConnection } from '@/lib/research/types';

type LoadState = {
  connections: ResearchPortalConnection[];
  sessions: ResearchBrowserSession[];
};

function statusTone(status: string): string {
  if (status === 'connected' || status === 'valid') return 'bg-emerald-50 text-emerald-800 border-emerald-200';
  if (status === 'pending' || status === 'needs_login' || status === 'idle') {
    return 'bg-amber-50 text-amber-800 border-amber-200';
  }
  if (status === 'error' || status === 'expired') return 'bg-rose-50 text-rose-800 border-rose-200';
  return 'bg-slate-50 text-slate-700 border-slate-200';
}

export default function ConnectorsPanel() {
  const workspaceId = DEFAULT_RESEARCH_WORKSPACE.id;
  const [data, setData] = useState<LoadState>({ connections: [], sessions: [] });
  const [loading, setLoading] = useState(true);
  const [busyPortal, setBusyPortal] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/research/connectors?workspaceId=${encodeURIComponent(workspaceId)}`, {
        credentials: 'include',
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load connectors');
      setData({ connections: json.connections || [], sessions: json.sessions || [] });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function callPortal(portal: string, action: 'connect' | 'validate' | 'capture') {
    setBusyPortal(portal);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch(`/api/research/connectors/${portal}/${action}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `${action} failed`);
      setMessage(json.message || `${action} ok for ${portal}`);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : `${action} failed`);
    } finally {
      setBusyPortal(null);
    }
  }

  const sessionByPortal = new Map(
    data.sessions.map((s) => [s.portal || s.portalKey, s]),
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Authenticate each portal once. Prop/Research reuses encrypted browser sessions for searches.
        </p>
        <button
          type="button"
          onClick={() => void refresh()}
          className="inline-flex h-8 items-center rounded-md border border-slate-200 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200"
        >
          Refresh
        </button>
      </div>

      {message ? (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm text-slate-500">Loading connectors…</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-950">
              <tr>
                <th className="px-4 py-3 font-semibold">Portal</th>
                <th className="px-4 py-3 font-semibold">Connection</th>
                <th className="px-4 py-3 font-semibold">Session</th>
                <th className="px-4 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.connections.map((c) => {
                const session = sessionByPortal.get(c.portalKey);
                const busy = busyPortal === c.portalKey;
                return (
                  <tr key={c.portalKey} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                    <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">
                      {c.portalName}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded border px-2 py-0.5 text-xs font-medium ${statusTone(c.status)}`}>
                        {c.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded border px-2 py-0.5 text-xs font-medium ${statusTone(session?.sessionStatus || 'idle')}`}
                      >
                        {session?.sessionStatus || 'none'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void callPortal(c.portalKey, 'connect')}
                          className="h-8 rounded-md border border-slate-200 px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200"
                        >
                          Connect
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void callPortal(c.portalKey, 'capture')}
                          className="h-8 rounded-md border border-slate-200 px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200"
                        >
                          Capture
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void callPortal(c.portalKey, 'validate')}
                          className="h-8 rounded-md bg-slate-900 px-2.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900"
                        >
                          Validate
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-slate-500">
        Local login: <code className="rounded bg-slate-100 px-1 py-0.5 dark:bg-slate-800">npx tsx scripts/research-portal-login.ts --portal=housing</code>
        {' '}then click Capture.
      </p>
    </div>
  );
}
