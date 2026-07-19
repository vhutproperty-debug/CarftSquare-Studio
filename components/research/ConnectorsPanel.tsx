'use client';

import { useCallback, useEffect, useState } from 'react';
import { DEFAULT_RESEARCH_WORKSPACE } from '@/lib/research/business';
import type {
  ConnectorStatusCard,
  ConnectFlowPhase,
  PublicConnectSession,
} from '@/lib/research/browser-gateway/types';

const PHASE_LABEL: Record<ConnectFlowPhase, string> = {
  queued: 'Queueing…',
  connecting: 'Worker Connected',
  opening_browser: 'Opening Browser…',
  waiting_for_login: 'Waiting for Login…',
  capturing: 'Capturing Session…',
  encrypting: 'Encrypting…',
  validating: 'Validating…',
  connected: 'Connected',
  failed: 'Failed',
  expired: 'Expired',
  cancelled: 'Cancelled',
};

const WORKER_OFFLINE_MSG =
  'Browser Worker is not running. Start it using:\nnpm run research:browser-worker';

function statusTone(status: string): string {
  if (status === 'connected' || status === 'healthy') {
    return 'bg-emerald-50 text-emerald-800 border-emerald-200';
  }
  if (
    status === 'pending' ||
    status === 'needs_login' ||
    status === 'connecting' ||
    status === 'queued' ||
    status === 'degraded'
  ) {
    return 'bg-amber-50 text-amber-800 border-amber-200';
  }
  if (status === 'error' || status === 'expired' || status === 'failing' || status === 'failed') {
    return 'bg-rose-50 text-rose-800 border-rose-200';
  }
  return 'bg-slate-50 text-slate-700 border-slate-200';
}

function fmt(ts?: string) {
  if (!ts) return '—';
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return '—';
  }
}

type WorkerStatus = {
  online: boolean;
  provider: string;
  queueSize: number;
  lastError: string | null;
};

type WorkerLog = { at: string; level: string; message: string };

export default function ConnectorsPanel() {
  const workspaceId = DEFAULT_RESEARCH_WORKSPACE.id;
  const [connectors, setConnectors] = useState<ConnectorStatusCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyPortal, setBusyPortal] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [liveSession, setLiveSession] = useState<PublicConnectSession | null>(null);
  const [worker, setWorker] = useState<WorkerStatus | null>(null);
  const [logs, setLogs] = useState<WorkerLog[]>([]);
  const [drawerPortal, setDrawerPortal] = useState<string | null>(null);
  const [drawerDetail, setDrawerDetail] = useState<{
    connectSession?: PublicConnectSession | null;
    session?: {
      id: string;
      portal: string;
      status: string;
      createdAt: string;
      lastUsed?: string;
      lastValidated?: string;
      expiresAt?: string;
    } | null;
  } | null>(null);
  const [previewKey, setPreviewKey] = useState(0);
  const [queuedSince, setQueuedSince] = useState<number | null>(null);

  const refreshWorker = useCallback(async () => {
    try {
      const res = await fetch('/api/research/worker/status?ping=1', {
        credentials: 'include',
        cache: 'no-store',
      });
      const json = await res.json();
      if (res.ok) {
        setWorker({
          online: Boolean(json.online),
          provider: json.provider || 'self_hosted',
          queueSize: Number(json.queueSize || 0),
          lastError: json.lastError || null,
        });
      }
    } catch {
      setWorker({
        online: false,
        provider: 'self_hosted',
        queueSize: 0,
        lastError: 'Worker status unreachable',
      });
    }
  }, []);

  const refreshLogs = useCallback(async () => {
    try {
      const res = await fetch('/api/research/worker/logs?limit=60', {
        credentials: 'include',
        cache: 'no-store',
      });
      const json = await res.json();
      if (res.ok) setLogs(json.logs || []);
    } catch {
      /* ignore */
    }
  }, []);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/research/connectors/status?workspaceId=${encodeURIComponent(workspaceId)}`,
        { credentials: 'include' },
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load connectors');
      setConnectors(json.connectors || []);
      if (!liveSession) setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [workspaceId, liveSession]);

  useEffect(() => {
    void refresh();
    void refreshWorker();
    const t = setInterval(() => {
      void refresh();
      void refreshWorker();
    }, 10_000);
    return () => clearInterval(t);
  }, [refresh, refreshWorker]);

  // Poll live connect + logs; fail fast if worker goes offline while queueing
  useEffect(() => {
    if (!liveSession?.id) return;
    let cancelled = false;

    const poll = async () => {
      try {
        await refreshWorker();
        await refreshLogs();

        const statusRes = await fetch('/api/research/worker/status', {
          credentials: 'include',
          cache: 'no-store',
        });
        const statusJson = await statusRes.json();
        const online = Boolean(statusJson.online);

        if (!online && liveSession.phase === 'queued') {
          const waited = queuedSince ? Date.now() - queuedSince : 0;
          if (waited > 8_000) {
            setError(WORKER_OFFLINE_MSG);
            setLiveSession((prev) =>
              prev
                ? {
                    ...prev,
                    phase: 'failed',
                    errorMessage: WORKER_OFFLINE_MSG,
                    message: 'Worker offline',
                  }
                : prev,
            );
            return;
          }
        }

        const res = await fetch(
          `/api/research/connectors/session?workspaceId=${encodeURIComponent(workspaceId)}&id=${encodeURIComponent(liveSession.id)}`,
          { credentials: 'include' },
        );
        const json = await res.json();
        if (!res.ok || cancelled) return;
        const next = json.connectSession as PublicConnectSession;
        setLiveSession(next);
        setPreviewKey((k) => k + 1);
        if (next.phase === 'connected') {
          setMessage(`${next.portalName} connected successfully.`);
          setQueuedSince(null);
          await refresh();
        }
        if (next.phase === 'failed' || next.phase === 'expired' || next.phase === 'cancelled') {
          setError(next.errorMessage || `Connect ${next.phase}`);
          setQueuedSince(null);
        }
      } catch {
        /* ignore transient */
      }
    };

    void poll();
    const t = setInterval(() => void poll(), 2_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [liveSession?.id, liveSession?.phase, workspaceId, refresh, refreshWorker, refreshLogs, queuedSince]);

  async function postAction(
    path: string,
    portal: string,
    opts?: { openLive?: boolean },
  ) {
    setBusyPortal(portal);
    setError(null);
    setMessage(null);

    if (opts?.openLive || path === 'connect' || path === 'reconnect') {
      await refreshWorker();
      const statusRes = await fetch('/api/research/worker/status?ping=1', {
        credentials: 'include',
        cache: 'no-store',
      });
      const statusJson = await statusRes.json().catch(() => ({}));
      if (!statusJson.online) {
        setError(WORKER_OFFLINE_MSG);
        setBusyPortal(null);
        return;
      }
    }

    try {
      const res = await fetch(`/api/research/connectors/${path}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId, portal }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || `${path} failed`);
      }
      setMessage(json.message || 'OK');
      if (opts?.openLive && json.connectSession) {
        setLiveSession(json.connectSession);
        setQueuedSince(Date.now());
        void refreshLogs();
      }
      await refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : `${path} failed`;
      setError(msg.includes('Browser Worker') ? msg : msg);
    } finally {
      setBusyPortal(null);
    }
  }

  async function openDrawer(portal: string) {
    setDrawerPortal(portal);
    try {
      const res = await fetch(
        `/api/research/connectors/session?workspaceId=${encodeURIComponent(workspaceId)}&portal=${encodeURIComponent(portal)}`,
        { credentials: 'include' },
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed');
      const latest = (json.connectSessions || [])[0] || null;
      setDrawerDetail({
        connectSession: latest,
        session: json.session,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load session');
    }
  }

  const showLive =
    liveSession &&
    !['connected', 'failed', 'expired', 'cancelled'].includes(liveSession.phase);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Connect portals in-browser. The local Browser Worker opens Chromium, captures encrypted
          cookies, and validates automatically.
        </p>
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex rounded border px-2 py-0.5 text-xs font-medium ${
              worker?.online
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                : 'border-rose-200 bg-rose-50 text-rose-800'
            }`}
          >
            Worker {worker?.online ? 'Online' : 'Offline'}
            {worker?.provider ? ` · ${worker.provider}` : ''}
          </span>
          <button
            type="button"
            onClick={() => {
              void refresh();
              void refreshWorker();
            }}
            className="inline-flex h-8 items-center rounded-md border border-slate-200 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200"
          >
            Refresh
          </button>
        </div>
      </div>

      {!worker?.online ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 whitespace-pre-wrap">
          {WORKER_OFFLINE_MSG}
        </div>
      ) : null}

      {message ? (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800 whitespace-pre-wrap">
          {error}
        </p>
      ) : null}

      {showLive ? (
        <section className="overflow-hidden rounded-xl border border-orange-200 bg-white shadow-sm dark:border-orange-900 dark:bg-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3 dark:border-slate-800">
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Connect — {liveSession.portalName}
              </p>
              <p className="text-xs text-slate-500">
                {PHASE_LABEL[liveSession.phase]}
                {liveSession.message ? ` · ${liveSession.message}` : ''}
              </p>
            </div>
            <span
              className={`inline-flex rounded border px-2 py-0.5 text-xs font-medium ${statusTone(liveSession.phase)}`}
            >
              {PHASE_LABEL[liveSession.phase]}
            </span>
          </div>

          <ol className="flex flex-wrap gap-2 border-b border-slate-100 px-4 py-2 text-[11px] dark:border-slate-800">
            {(
              [
                'queued',
                'connecting',
                'opening_browser',
                'waiting_for_login',
                'capturing',
                'encrypting',
                'validating',
                'connected',
              ] as ConnectFlowPhase[]
            ).map((phase) => {
              const order = [
                'queued',
                'connecting',
                'opening_browser',
                'waiting_for_login',
                'capturing',
                'encrypting',
                'validating',
                'connected',
              ];
              const currentIdx = order.indexOf(liveSession.phase);
              const idx = order.indexOf(phase);
              const active = idx <= currentIdx && currentIdx >= 0;
              return (
                <li
                  key={phase}
                  className={`rounded px-2 py-0.5 ${
                    active
                      ? 'bg-orange-100 font-medium text-orange-900'
                      : 'bg-slate-50 text-slate-400'
                  }`}
                >
                  {PHASE_LABEL[phase]}
                </li>
              );
            })}
          </ol>

          <div className="grid gap-0 lg:grid-cols-[1.4fr_1fr]">
            <div className="bg-slate-950 p-2">
              {liveSession.liveViewUrl ? (
                <iframe
                  title="Remote browser"
                  src={liveSession.liveViewUrl}
                  className="h-[420px] w-full rounded-md border-0 bg-white"
                  allow="clipboard-read; clipboard-write"
                />
              ) : liveSession.previewUrl &&
                liveSession.phase !== 'queued' &&
                liveSession.phase !== 'connecting' ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={previewKey}
                  src={`${liveSession.previewUrl}&t=${previewKey}`}
                  alt="Live browser preview"
                  className="mx-auto max-h-[420px] w-auto rounded-md"
                />
              ) : (
                <div className="flex h-64 flex-col items-center justify-center gap-2 px-4 text-center text-sm text-slate-400">
                  {liveSession.phase === 'queued' ? (
                    <>
                      <p>Queueing… waiting for Browser Worker</p>
                      <p className="text-xs">
                        If this stays here, ensure the worker is running:
                        <code className="mx-1 rounded bg-slate-800 px-1">
                          npm run research:browser-worker
                        </code>
                      </p>
                    </>
                  ) : (
                    <p>{PHASE_LABEL[liveSession.phase]}</p>
                  )}
                </div>
              )}
            </div>
            <div className="border-l border-slate-100 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Live worker logs
              </p>
              <pre className="h-[400px] overflow-auto rounded-md bg-slate-900 p-2 text-[11px] leading-relaxed text-slate-200">
                {logs.length
                  ? logs
                      .map(
                        (l) =>
                          `${new Date(l.at).toLocaleTimeString()} [${l.level}] ${l.message}`,
                      )
                      .join('\n')
                  : worker?.online
                    ? 'Waiting for worker log lines…'
                    : WORKER_OFFLINE_MSG}
              </pre>
            </div>
          </div>
        </section>
      ) : null}

      {loading ? (
        <p className="text-sm text-slate-500">Loading connectors…</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {connectors.map((c) => {
            const busy = busyPortal === c.portal;
            const phaseLabel = c.connectPhase ? PHASE_LABEL[c.connectPhase] : null;
            const idle = !c.connectPhase && (c.status === 'disconnected' || c.status === 'pending');
            return (
              <article
                key={c.portal}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {c.portalName}
                    </h3>
                    <p className="text-xs capitalize text-slate-500">{c.portal}</p>
                  </div>
                  <span
                    className={`inline-flex rounded border px-2 py-0.5 text-xs font-medium ${statusTone(c.status)}`}
                  >
                    {phaseLabel || (idle ? 'Idle' : c.status.replace(/_/g, ' '))}
                  </span>
                </div>

                <dl className="mt-3 grid grid-cols-2 gap-x-2 gap-y-1 text-[11px] text-slate-500">
                  <div>
                    <dt className="font-semibold text-slate-400">Health</dt>
                    <dd className="capitalize text-slate-700 dark:text-slate-300">{c.health}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-slate-400">Last login</dt>
                    <dd className="text-slate-700 dark:text-slate-300">{fmt(c.lastLoginAt)}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-slate-400">Last validation</dt>
                    <dd className="text-slate-700 dark:text-slate-300">{fmt(c.lastValidatedAt)}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-slate-400">Session expiry</dt>
                    <dd className="text-slate-700 dark:text-slate-300">{fmt(c.sessionExpiresAt)}</dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="font-semibold text-slate-400">Last crawl</dt>
                    <dd className="text-slate-700 dark:text-slate-300">{fmt(c.lastCrawlAt)}</dd>
                  </div>
                </dl>

                {c.lastError ? (
                  <p className="mt-3 rounded-md border border-rose-200 bg-rose-50 px-2 py-1.5 text-[11px] text-rose-800 whitespace-pre-wrap">
                    {c.lastError}
                  </p>
                ) : null}

                <div className="mt-4 flex flex-wrap gap-2">
                  {c.status === 'connected' ? (
                    <>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void postAction('reconnect', c.portal, { openLive: true })}
                        className="h-8 rounded-md border border-slate-200 px-2.5 text-xs font-medium disabled:opacity-50 dark:border-slate-700"
                      >
                        Reconnect
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void postAction('refresh', c.portal)}
                        className="h-8 rounded-md border border-slate-200 px-2.5 text-xs font-medium disabled:opacity-50 dark:border-slate-700"
                      >
                        Refresh
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void postAction('disconnect', c.portal)}
                        className="h-8 rounded-md border border-rose-200 px-2.5 text-xs font-medium text-rose-700 disabled:opacity-50"
                      >
                        Disconnect
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      disabled={busy || c.status === 'connecting'}
                      onClick={() => void postAction('connect', c.portal, { openLive: true })}
                      className="h-8 rounded-md bg-slate-900 px-2.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900"
                    >
                      {c.status === 'connecting' ? 'Connecting…' : 'Connect'}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => void openDrawer(c.portal)}
                    className="h-8 rounded-md border border-slate-200 px-2.5 text-xs font-medium dark:border-slate-700"
                  >
                    View Session
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {drawerPortal ? (
        <div className="fixed inset-0 z-40 flex justify-end bg-black/30">
          <button
            type="button"
            aria-label="Close"
            className="flex-1"
            onClick={() => {
              setDrawerPortal(null);
              setDrawerDetail(null);
            }}
          />
          <aside className="h-full w-full max-w-md overflow-y-auto bg-white p-5 shadow-xl dark:bg-slate-900">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Session details
              </h2>
              <button
                type="button"
                className="text-xs text-slate-500"
                onClick={() => {
                  setDrawerPortal(null);
                  setDrawerDetail(null);
                }}
              >
                Close
              </button>
            </div>
            <dl className="mt-4 space-y-2 text-sm text-slate-600 dark:text-slate-300">
              <div>
                <dt className="text-xs font-semibold uppercase text-slate-400">Portal</dt>
                <dd>{drawerPortal}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase text-slate-400">Status</dt>
                <dd>{drawerDetail?.session?.status || 'none'}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase text-slate-400">Created</dt>
                <dd>{fmt(drawerDetail?.session?.createdAt)}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase text-slate-400">Last used</dt>
                <dd>{fmt(drawerDetail?.session?.lastUsed)}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase text-slate-400">Last validated</dt>
                <dd>{fmt(drawerDetail?.session?.lastValidated)}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase text-slate-400">Expires</dt>
                <dd>{fmt(drawerDetail?.session?.expiresAt)}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase text-slate-400">Worker</dt>
                <dd>{drawerDetail?.connectSession?.workerId || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase text-slate-400">Browser version</dt>
                <dd>{drawerDetail?.connectSession?.browserVersion || '—'}</dd>
              </div>
            </dl>
            <p className="mt-4 text-xs text-slate-500">
              Cookies and authentication tokens are encrypted at rest and never shown here.
            </p>
          </aside>
        </div>
      ) : null}
    </div>
  );
}
