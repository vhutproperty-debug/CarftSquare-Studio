'use client';

import { useCallback, useEffect, useState } from 'react';
import { DEFAULT_RESEARCH_WORKSPACE } from '@/lib/research/business';
import type {
  ConnectorDisplayState,
  ConnectorStatusCard,
  ConnectFlowPhase,
  PublicConnectSession,
} from '@/lib/research/browser-gateway/types';

const PHASE_LABEL: Record<ConnectFlowPhase, string> = {
  queued: 'Preparing Browser',
  connecting: 'Preparing Browser',
  opening_browser: 'Opening Secure Browser…',
  waiting_for_login: 'Waiting for Login',
  capturing: 'Capturing Session',
  encrypting: 'Encrypting',
  validating: 'Validating',
  connected: 'Connected',
  failed: 'Failed',
  expired: 'Expired',
  cancelled: 'Cancelled',
};

/** Stepper labels shown during a live connect (includes Browser Ready). */
const CONNECT_STEPS = [
  'Preparing Browser',
  'Browser Ready',
  'Waiting for Login',
  'Authenticating',
  'Capturing Session',
  'Encrypting',
  'Validating',
  'Connected',
] as const;

function activeConnectStepIndex(session: PublicConnectSession): number {
  if (session.phase === 'queued' || session.phase === 'connecting' || session.phase === 'opening_browser') {
    return 0;
  }
  if (session.phase === 'waiting_for_login') {
    return session.liveViewUrl ? 2 : 0;
  }
  if (session.phase === 'capturing') return 4;
  if (session.phase === 'encrypting') return 5;
  if (session.phase === 'validating') return 6;
  if (session.phase === 'connected') return 7;
  return 0;
}

const WORKER_OFFLINE_MSG =
  'Browser Worker is not running. Start it using:\nnpm run research:browser-worker';

function displayStateOf(c: ConnectorStatusCard): ConnectorDisplayState {
  if (c.displayState) return c.displayState;
  if (c.status === 'connected') return 'connected';
  if (c.status === 'connecting') return 'reconnecting';
  if (c.status === 'error') return 'connection_failed';
  if (c.status === 'needs_login' || c.status === 'expired') return 'session_expired';
  return 'never_connected';
}

function statusTone(state: ConnectorDisplayState | string): string {
  if (state === 'connected' || state === 'healthy') {
    return 'bg-emerald-50 text-emerald-800 border-emerald-200';
  }
  if (state === 'session_expired' || state === 'reconnecting' || state === 'degraded') {
    return 'bg-amber-50 text-amber-800 border-amber-200';
  }
  if (state === 'connection_failed' || state === 'failing' || state === 'failed') {
    return 'bg-rose-50 text-rose-800 border-rose-200';
  }
  return 'bg-slate-50 text-slate-700 border-slate-200';
}

function stateDot(state: ConnectorDisplayState): string {
  if (state === 'connected') return 'bg-emerald-500';
  if (state === 'session_expired' || state === 'reconnecting') return 'bg-amber-400';
  if (state === 'connection_failed') return 'bg-rose-500';
  return 'bg-slate-300';
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
  const [validating, setValidating] = useState(false);
  const [busyPortal, setBusyPortal] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [liveSession, setLiveSession] = useState<PublicConnectSession | null>(null);
  const [worker, setWorker] = useState<WorkerStatus | null>(null);
  const [logs, setLogs] = useState<WorkerLog[]>([]);
  const [drawerPortal, setDrawerPortal] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState<string | null>(null);
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
  const [liveValidated, setLiveValidated] = useState(false);

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

  const refresh = useCallback(async (opts?: { live?: boolean; clearError?: boolean }) => {
    const live = Boolean(opts?.live);
    if (live) setValidating(true);
    try {
      const qs = new URLSearchParams({ workspaceId });
      if (live) qs.set('live', '1');
      const res = await fetch(`/api/research/connectors/status?${qs.toString()}`, {
        credentials: 'include',
        cache: 'no-store',
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load connectors');
      setConnectors(json.connectors || []);
      setLiveValidated(Boolean(json.liveValidated));
      if (opts?.clearError) setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
      setValidating(false);
    }
  }, [workspaceId]);

  // Initial load: live-validate sessions so cards are not cache-only.
  useEffect(() => {
    void refresh({ live: true, clearError: true });
    void refreshWorker();
    // Soft poll (no live Chromium) while page is open.
    const t = setInterval(() => {
      void refresh({ live: false });
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
          await refresh({ live: true });
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
      await refresh({ live: false });
    } catch (err) {
      const msg = err instanceof Error ? err.message : `${path} failed`;
      setError(msg);
    } finally {
      setBusyPortal(null);
    }
  }

  async function retryValidate(portal: string) {
    setBusyPortal(portal);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/research/connectors/${encodeURIComponent(portal)}/validate`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Retry failed');
      }
      if (json.ok) {
        setMessage(`${portal} session verified.`);
      } else {
        setError(json.message || json.error || 'Session could not be verified.');
      }
      await refresh({ live: false });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Retry failed');
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
          Manage portal sessions for research. Status is verified live against the browser worker
          whenever possible — never guess from stale cache alone.
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
          <span className="hidden text-[11px] text-slate-400 sm:inline">
            {validating
              ? 'Live validating…'
              : liveValidated
                ? 'Live verified'
                : 'Cached snapshot'}
          </span>
          <button
            type="button"
            disabled={validating}
            onClick={() => {
              void refresh({ live: true });
              void refreshWorker();
            }}
            className="inline-flex h-8 items-center rounded-md border border-slate-200 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200"
          >
            {validating ? 'Validating…' : 'Refresh & verify'}
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
            {CONNECT_STEPS.map((label, idx) => {
              const currentIdx = activeConnectStepIndex(liveSession);
              const active = idx <= currentIdx;
              return (
                <li
                  key={label}
                  className={`rounded px-2 py-0.5 ${
                    active
                      ? 'bg-orange-100 font-medium text-orange-900'
                      : 'bg-slate-50 text-slate-400'
                  }`}
                >
                  {label}
                </li>
              );
            })}
          </ol>

          <div className="grid gap-0 lg:grid-cols-[1.4fr_1fr]">
            <div className="flex min-h-[280px] flex-col items-center justify-center gap-4 bg-slate-950 p-6 text-center">
              {liveSession.phase === 'queued' ||
              liveSession.phase === 'connecting' ||
              liveSession.phase === 'opening_browser' ? (
                <div className="space-y-2 text-sm text-slate-300">
                  <p className="text-base font-medium text-white">Opening Secure Browser…</p>
                  <p className="text-xs text-slate-400">
                    Preparing an isolated remote Chromium session on Railway.
                  </p>
                </div>
              ) : liveSession.liveViewUrl && liveSession.phase === 'waiting_for_login' ? (
                <div className="space-y-4">
                  <div className="space-y-1">
                    <p className="text-base font-medium text-white">Browser Ready</p>
                    <p className="text-xs text-slate-400">
                      Sign in inside the secure remote window. This tab stays on CraftSquare.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      window.open(
                        liveSession.liveViewUrl,
                        `cs-remote-${liveSession.id}`,
                        'noopener,noreferrer',
                      );
                    }}
                    className="inline-flex h-10 items-center justify-center rounded-md bg-orange-500 px-5 text-sm font-semibold text-white hover:bg-orange-600"
                  >
                    Open Secure Login Window
                  </button>
                  <p className="text-[11px] text-slate-500">
                    Session expires automatically. Cookies never pass through the remote view.
                  </p>
                </div>
              ) : (
                <div className="space-y-2 text-sm text-slate-300">
                  <p className="text-base font-medium text-white">
                    {PHASE_LABEL[liveSession.phase]}
                  </p>
                  {liveSession.message ? (
                    <p className="text-xs text-slate-400">{liveSession.message}</p>
                  ) : null}
                  {liveSession.previewUrl &&
                  !['queued', 'connecting', 'opening_browser'].includes(liveSession.phase) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={previewKey}
                      src={`${liveSession.previewUrl}&t=${previewKey}`}
                      alt="Browser preview"
                      className="mx-auto mt-2 max-h-[240px] w-auto rounded-md border border-slate-800"
                    />
                  ) : null}
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
            const state = displayStateOf(c);
            const label = c.displayLabel || (
              state === 'never_connected'
                ? 'Not Connected'
                : state === 'session_expired'
                  ? 'Session Expired'
                  : state === 'connection_failed'
                    ? 'Connection Failed'
                    : state === 'reconnecting'
                      ? 'Reconnecting'
                      : 'Connected'
            );
            const showDetails = detailsOpen === c.portal;

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
                    className={`inline-flex items-center gap-1.5 rounded border px-2 py-0.5 text-xs font-medium ${statusTone(state)}`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${stateDot(state)}`} aria-hidden />
                    {label}
                  </span>
                </div>

                {/* Diagnostics checklist — every portal independently diagnosable */}
                {c.diagnostics?.checks?.length ? (
                  <ul className="mt-3 space-y-1 border-t border-slate-100 pt-3 dark:border-slate-800">
                    {c.diagnostics.checks.map((check) => (
                      <li
                        key={check.id}
                        className="flex items-start gap-2 text-[11px] text-slate-600 dark:text-slate-300"
                      >
                        <span
                          className={
                            check.ok === true
                              ? 'text-emerald-600'
                              : check.ok === false
                                ? 'text-rose-600'
                                : 'text-slate-400'
                          }
                          aria-hidden
                        >
                          {check.ok === true ? '✓' : check.ok === false ? '✗' : '·'}
                        </span>
                        <span>
                          <span className="font-medium text-slate-800 dark:text-slate-100">
                            {check.label}
                          </span>
                          {check.detail ? (
                            <span className="block text-slate-400">{check.detail}</span>
                          ) : null}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : null}

                {c.diagnostics?.failureReason || c.diagnostics?.suggestedAction ? (
                  <div className="mt-2 space-y-1 rounded-md border border-slate-100 bg-slate-50 px-2 py-1.5 text-[11px] dark:border-slate-800 dark:bg-slate-950">
                    {c.diagnostics.failureReason ? (
                      <p>
                        <span className="font-medium text-rose-700 dark:text-rose-300">Reason: </span>
                        <span className="text-slate-700 dark:text-slate-200">
                          {c.diagnostics.failureReason}
                        </span>
                      </p>
                    ) : null}
                    {c.diagnostics.suggestedAction ? (
                      <p>
                        <span className="font-medium text-slate-800 dark:text-slate-100">
                          Suggested action:{' '}
                        </span>
                        <span className="text-slate-600 dark:text-slate-300">
                          {c.diagnostics.suggestedAction}
                        </span>
                      </p>
                    ) : null}
                  </div>
                ) : null}

                {/* State-specific body */}
                {state === 'connected' ? (
                  <dl className="mt-3 space-y-1.5 text-[12px] text-slate-600 dark:text-slate-300">
                    <div className="flex justify-between gap-2">
                      <dt className="text-slate-400">Last verified</dt>
                      <dd className="text-right text-slate-800 dark:text-slate-100">
                        {fmt(c.lastValidatedAt)}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-slate-400">Session age</dt>
                      <dd className="text-right text-slate-800 dark:text-slate-100">
                        {c.sessionAgeLabel || '—'}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-slate-400">Browser state</dt>
                      <dd className="text-right text-slate-800 dark:text-slate-100">
                        {c.diagnostics?.browserState || 'ready'}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-slate-400">Availability</dt>
                      <dd
                        className={`text-right font-medium ${
                          c.availableForResearch
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : 'text-amber-700 dark:text-amber-400'
                        }`}
                      >
                        {c.availableLabel ||
                          (c.availableForResearch
                            ? 'Available for research'
                            : 'Not available')}
                      </dd>
                    </div>
                  </dl>
                ) : null}

                {state === 'session_expired' ? (
                  <div className="mt-3 space-y-1 text-[12px] text-amber-900 dark:text-amber-200">
                    <p className="font-medium">Session expired</p>
                    <p className="text-amber-800/80 dark:text-amber-200/80">
                      Reconnect required to use this portal for research.
                    </p>
                    {c.lastValidatedAt ? (
                      <p className="text-[11px] text-slate-500">
                        Last verified {fmt(c.lastValidatedAt)}
                      </p>
                    ) : null}
                  </div>
                ) : null}

                {state === 'connection_failed' ? (
                  <div className="mt-3 space-y-2">
                    <p className="text-[12px] font-medium text-rose-800 dark:text-rose-300">
                      {/crash/i.test(c.diagnostics?.failureReason || c.humanError || '')
                        ? 'Browser crashed'
                        : 'Connection failed'}
                    </p>
                    {showDetails ? (
                      <dl className="rounded-md border border-slate-100 bg-slate-50 p-2 text-[11px] text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
                        <div className="flex justify-between gap-2">
                          <dt>Last verified</dt>
                          <dd>{fmt(c.lastValidatedAt)}</dd>
                        </div>
                        <div className="flex justify-between gap-2">
                          <dt>Session exists</dt>
                          <dd>{c.sessionExists ? 'Yes' : 'No'}</dd>
                        </div>
                        <div className="flex justify-between gap-2">
                          <dt>Validation</dt>
                          <dd>{c.diagnostics?.validationResult || 'failed'}</dd>
                        </div>
                        <div className="flex justify-between gap-2">
                          <dt>Expires</dt>
                          <dd>{fmt(c.sessionExpiresAt)}</dd>
                        </div>
                      </dl>
                    ) : null}
                  </div>
                ) : null}

                {state === 'never_connected' ? (
                  <div className="mt-3 text-[12px] text-slate-600 dark:text-slate-300">
                    <p className="font-medium text-slate-800 dark:text-slate-100">Not connected</p>
                    <p className="mt-0.5 text-slate-500">
                      Connect this portal to unlock live research results.
                    </p>
                  </div>
                ) : null}

                {state === 'reconnecting' ? (
                  <div className="mt-3 text-[12px] text-amber-900 dark:text-amber-200">
                    <p className="font-medium">
                      {c.connectPhase ? PHASE_LABEL[c.connectPhase] : 'Reconnecting…'}
                    </p>
                    <p className="text-amber-800/80 dark:text-amber-200/80">
                      Secure browser session in progress.
                    </p>
                  </div>
                ) : null}

                <div className="mt-4 flex flex-wrap gap-2">
                  {state === 'connected' ? (
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
                        disabled={busy || validating}
                        onClick={() => void retryValidate(c.portal)}
                        className="h-8 rounded-md border border-slate-200 px-2.5 text-xs font-medium disabled:opacity-50 dark:border-slate-700"
                      >
                        Verify
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
                  ) : null}

                  {state === 'session_expired' ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void postAction('reconnect', c.portal, { openLive: true })}
                      className="h-8 rounded-md bg-slate-900 px-2.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900"
                    >
                      Reconnect
                    </button>
                  ) : null}

                  {state === 'connection_failed' ? (
                    <>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void retryValidate(c.portal)}
                        className="h-8 rounded-md bg-slate-900 px-2.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900"
                      >
                        Retry
                      </button>
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
                        onClick={() =>
                          setDetailsOpen((prev) => (prev === c.portal ? null : c.portal))
                        }
                        className="h-8 rounded-md border border-slate-200 px-2.5 text-xs font-medium dark:border-slate-700"
                      >
                        {showDetails ? 'Hide details' : 'View details'}
                      </button>
                    </>
                  ) : null}

                  {state === 'never_connected' ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void postAction('connect', c.portal, { openLive: true })}
                      className="h-8 rounded-md bg-slate-900 px-2.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900"
                    >
                      Connect
                    </button>
                  ) : null}

                  {state === 'reconnecting' ? (
                    <button
                      type="button"
                      disabled
                      className="h-8 rounded-md border border-amber-200 bg-amber-50 px-2.5 text-xs font-medium text-amber-900 opacity-80"
                    >
                      Connecting…
                    </button>
                  ) : null}

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
                <dd className="capitalize">
                  {(drawerDetail?.session?.status || 'none').replace(/_/g, ' ')}
                </dd>
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
