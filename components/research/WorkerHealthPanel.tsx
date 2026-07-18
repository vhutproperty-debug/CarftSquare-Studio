'use client';

import { useCallback, useEffect, useState } from 'react';

type WorkerStatus = {
  online: boolean;
  provider: string;
  queueSize: number;
  activeSessions: number;
  uptime: number;
  version: string;
  lastHeartbeatAt: string | null;
  lastError: string | null;
  port: number | null;
  workerId: string | null;
  healthy: boolean;
};

function fmtUptime(sec: number) {
  if (!sec) return '—';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h) return `${h}h ${m}m`;
  if (m) return `${m}m ${s}s`;
  return `${s}s`;
}

export default function WorkerHealthPanel() {
  const [status, setStatus] = useState<WorkerStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/research/worker/status?ping=1', {
        credentials: 'include',
        cache: 'no-store',
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load worker status');
      setStatus(json);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  }, []);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 10_000);
    return () => clearInterval(t);
  }, [load]);

  if (error && !status) {
    return (
      <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
        {error}
      </p>
    );
  }

  if (!status) {
    return <p className="text-sm text-slate-500">Checking browser worker…</p>;
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Browser Worker
            </h2>
            <p className="text-xs text-slate-500">
              Local control plane — Chromium never launches inside Next.js
            </p>
          </div>
          <span
            className={`rounded-md px-2 py-1 text-xs font-semibold uppercase ${
              status.online
                ? 'bg-emerald-100 text-emerald-800'
                : 'bg-rose-100 text-rose-800'
            }`}
          >
            {status.online ? 'Online' : 'Offline'}
          </span>
        </div>

        {!status.online ? (
          <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Browser Worker is not running. Start it using:
            <pre className="mt-2 overflow-x-auto rounded bg-white/80 px-2 py-1 text-xs">
              npm run research:browser-worker
            </pre>
          </div>
        ) : null}

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <Stat label="Provider" value={status.provider} />
          <Stat label="Queue size" value={status.queueSize} />
          <Stat label="Active sessions" value={status.activeSessions} />
          <Stat
            label="Last heartbeat"
            value={
              status.lastHeartbeatAt
                ? new Date(status.lastHeartbeatAt).toLocaleString()
                : '—'
            }
          />
          <Stat label="Uptime" value={fmtUptime(status.uptime)} />
          <Stat label="Version" value={status.version} />
          <Stat label="Port" value={status.port ?? '—'} />
          <Stat label="Worker ID" value={status.workerId || '—'} />
          <Stat label="Health" value={status.healthy ? 'healthy' : 'degraded'} />
        </div>

        {status.lastError ? (
          <p className="mt-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
            Last error: {status.lastError}
          </p>
        ) : (
          <p className="mt-4 text-xs text-slate-500">No recent worker errors.</p>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-slate-100 p-3 dark:border-slate-800">
      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 break-all text-sm font-semibold text-slate-900 dark:text-slate-100">
        {value}
      </p>
    </div>
  );
}
