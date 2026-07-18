'use client';

import { useCallback, useEffect, useState } from 'react';
import { DEFAULT_RESEARCH_WORKSPACE } from '@/lib/research/business';
import type {
  ConnectorStatusCard,
  ConnectFlowPhase,
  PublicConnectSession,
} from '@/lib/research/browser-gateway/types';

const PHASE_LABEL: Record<ConnectFlowPhase, string> = {
  queued: 'Connecting',
  connecting: 'Connecting',
  opening_browser: 'Opening Browser',
  waiting_for_login: 'Waiting For Login',
  capturing: 'Capturing Session',
  encrypting: 'Encrypting',
  validating: 'Validating',
  connected: 'Connected',
  failed: 'Failed',
  expired: 'Expired',
  cancelled: 'Cancelled',
};

function statusTone(status: string): string {
  if (status === 'connected' || status === 'healthy') {
    return 'bg-emerald-50 text-emerald-800 border-emerald-200';
  }
  if (
    status === 'pending' ||
    status === 'needs_login' ||
    status === 'connecting' ||
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

export default function ConnectorsPanel() {
  const workspaceId = DEFAULT_RESEARCH_WORKSPACE.id;
  const [connectors, setConnectors] = useState<ConnectorStatusCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyPortal, setBusyPortal] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [liveSession, setLiveSession] = useState<PublicConnectSession | null>(null);
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

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/research/connectors/status?workspaceId=${encodeURIComponent(workspaceId)}`,
        { credentials: 'include' },
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load connectors');
      setConnectors(json.connectors || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    void refresh();
    const t = setInterval(() => void refresh(), 4_000);
    return () => clearInterval(t);
  }, [refresh]);

  // Poll active live connect session
  useEffect(() => {
    if (!liveSession?.id) return;
    let cancelled = false;
    const poll = async () => {
      try {
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
          await refresh();
        }
        if (next.phase === 'failed' || next.phase === 'expired' || next.phase === 'cancelled') {
          setError(next.errorMessage || `Connect ${next.phase}`);
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
  }, [liveSession?.id, workspaceId, refresh]);

  async function postAction(
    path: string,
    portal: string,
    opts?: { openLive?: boolean },
  ) {
    setBusyPortal(portal);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/research/connectors/${path}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId, portal }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `${path} failed`);
      setMessage(json.message || 'OK');
      if (opts?.openLive && json.connectSession) {
        setLiveSession(json.connectSession);
      }
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : `${path} failed`);
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
          Connect portals in-browser. Prop/Research opens a remote session, captures encrypted
          cookies automatically, and validates — no terminal steps.
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

      {showLive ? (
        <section className="overflow-hidden rounded-xl border border-orange-200 bg-white shadow-sm dark:border-orange-900 dark:bg-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3 dark:border-slate-800">
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Live connection — {liveSession.portalName}
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
          <div className="bg-slate-950 p-2">
            {liveSession.liveViewUrl ? (
              <iframe
                title="Remote browser"
                src={liveSession.liveViewUrl}
                className="h-[480px] w-full rounded-md border-0 bg-white"
                allow="clipboard-read; clipboard-write"
              />
            ) : liveSession.previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={previewKey}
                src={`${liveSession.previewUrl}&t=${previewKey}`}
                alt="Live browser preview"
                className="mx-auto max-h-[480px] w-auto rounded-md"
              />
            ) : (
              <div className="flex h-64 items-center justify-center text-sm text-slate-400">
                Waiting for browser worker to open a remote session…
                <br />
                Run <code className="mx-1 rounded bg-slate-800 px-1">npm run research:browser-worker</code>
              </div>
            )}
          </div>
          <p className="px-4 py-2 text-xs text-slate-500">
            Log in inside the window above. Capture and validation run automatically when login is
            detected.
          </p>
        </section>
      ) : null}

      {loading ? (
        <p className="text-sm text-slate-500">Loading connectors…</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {connectors.map((c) => {
            const busy = busyPortal === c.portal;
            const phaseLabel = c.connectPhase ? PHASE_LABEL[c.connectPhase] : null;
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
                    {phaseLabel || c.status.replace(/_/g, ' ')}
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
              <div>
                <dt className="text-xs font-semibold uppercase text-slate-400">Health</dt>
                <dd>
                  {connectors.find((x) => x.portal === drawerPortal)?.health || 'unknown'}
                </dd>
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
