'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from 'react';
import Link from 'next/link';
import {
  ArrowUp,
  Bookmark,
  Check,
  Loader2,
  Plus,
  Search,
  Sparkles,
} from 'lucide-react';
import { DEFAULT_RESEARCH_WORKSPACE } from '@/lib/research/business';
import type {
  ResearchAiProgress,
  ResearchAiSession,
  ResearchReport,
  ResearchScoredListing,
} from '@/lib/research/types';
import ConnectorStatusChips from '@/components/research/ai/ConnectorStatusChips';
import ExecutiveReportPanel from '@/components/research/ai/ExecutiveReportPanel';
import PropertyCard from '@/components/research/ai/PropertyCard';
import ResearchCanvas from '@/components/research/ai/ResearchCanvas';
import ResearchMarkdown from '@/components/research/ai/ResearchMarkdown';
import {
  AnimatePresence,
  ResearchFadeUp,
  ResearchLivePanel,
  ResearchMessageMotion,
} from '@/components/research/ai/ResearchMotion';
import {
  RESEARCH_SUGGESTED_PROMPTS,
  SESSION_GROUP_LABEL,
  buildLiveResearchSteps,
  sessionTimeGroup,
  type SessionTimeGroup,
} from '@/components/research/ai/research-workspace-utils';
import '@/styles/research/workspace.css';

type PublicSession = Pick<
  ResearchAiSession,
  | 'id'
  | 'title'
  | 'status'
  | 'goals'
  | 'filters'
  | 'exclusions'
  | 'assumptions'
  | 'messages'
  | 'progress'
  | 'listings'
  | 'report'
  | 'clarificationQuestion'
> & {
  updatedAt?: string;
  createdAt?: string;
};

type SessionListItem = Pick<ResearchAiSession, 'id' | 'title' | 'status'> & {
  updatedAt?: string;
  createdAt?: string;
  progress?: ResearchAiProgress;
};

function TypewriterMarkdown({ text, active }: { text: string; active: boolean }) {
  const [shown, setShown] = useState(active ? '' : text);

  useEffect(() => {
    if (!active) {
      setShown(text);
      return;
    }
    setShown('');
    let i = 0;
    const id = window.setInterval(() => {
      i += Math.max(1, Math.ceil(text.length / 90));
      setShown(text.slice(0, i));
      if (i >= text.length) window.clearInterval(id);
    }, 16);
    return () => window.clearInterval(id);
  }, [text, active]);

  return (
    <div>
      <ResearchMarkdown text={shown} />
      {active && shown.length < text.length ? (
        <span className="mt-1 inline-block h-4 w-1 animate-pulse bg-orange-500 align-middle opacity-70" />
      ) : null}
    </div>
  );
}

export default function ResearchAnalystPanel() {
  const workspaceId = DEFAULT_RESEARCH_WORKSPACE.id;
  const [session, setSession] = useState<PublicSession | null>(null);
  const [sessions, setSessions] = useState<SessionListItem[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [animateAssistantId, setAnimateAssistantId] = useState<string | null>(null);
  const [canvasOpenMobile, setCanvasOpenMobile] = useState(false);
  const [comparison, setComparison] = useState<{
    rows: Array<{ attribute: string; values: Array<string | number | undefined> }>;
    strengths: Record<string, string[]>;
    weaknesses: Record<string, string[]>;
  } | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const pollRef = useRef<number | null>(null);

  const liveSteps = useMemo(
    () => buildLiveResearchSteps(session?.progress, busy),
    [session?.progress, busy],
  );

  const groupedSessions = useMemo(() => {
    const order: SessionTimeGroup[] = ['today', 'yesterday', 'last_week', 'older'];
    const map = new Map<SessionTimeGroup, SessionListItem[]>();
    for (const g of order) map.set(g, []);
    for (const s of sessions) {
      const g = sessionTimeGroup(s.updatedAt || s.createdAt);
      map.get(g)!.push(s);
    }
    return order
      .map((g) => ({ group: g, items: map.get(g)! }))
      .filter((g) => g.items.length > 0);
  }, [sessions]);

  const loadSessions = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/research/ai/sessions?workspaceId=${encodeURIComponent(workspaceId)}`,
        { credentials: 'include' },
      );
      const json = await res.json();
      if (res.ok && Array.isArray(json.sessions)) {
        setSessions(json.sessions);
        // Keep empty home hero — do not auto-open the latest session.
      }
    } catch {
      /* ignore */
    }
  }, [workspaceId]);

  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [session?.messages, liveSteps, busy, session?.listings?.length, session?.report]);

  useEffect(() => {
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
    };
  }, []);

  const ensureSession = useCallback(async (): Promise<{ id: string; base: PublicSession }> => {
    if (session?.id) return { id: session.id, base: session };
    const res = await fetch('/api/research/ai/sessions', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspaceId }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Could not start session');
    setSession(json.session);
    setSessions((prev) => [json.session, ...prev.filter((s) => s.id !== json.session.id)]);
    return { id: json.session.id as string, base: json.session as PublicSession };
  }, [session, workspaceId]);

  const pollProgress = useCallback((sessionId: string) => {
    if (pollRef.current) window.clearInterval(pollRef.current);
    pollRef.current = window.setInterval(async () => {
      try {
        const res = await fetch(`/api/research/ai/sessions/${sessionId}`, {
          credentials: 'include',
          cache: 'no-store',
        });
        const json = await res.json();
        if (res.ok && json.session) {
          setSession((prev) => ({
            ...(prev || json.session),
            ...json.session,
            messages: json.session.messages?.length
              ? json.session.messages
              : prev?.messages || [],
          }));
        }
      } catch {
        /* ignore poll errors */
      }
    }, 900);
  }, []);

  async function send(textOverride?: string) {
    const text = (textOverride ?? input).trim();
    if (!text || busy) return;
    setBusy(true);
    setError(null);
    setComparison(null);
    setInput('');
    setCanvasOpenMobile(true);

    try {
      const { id, base } = await ensureSession();

      const optimisticId = `local-user-${Date.now()}`;
      setSession((prev) => {
        const current = prev?.id === id ? prev : base;
        return {
          ...current,
          messages: [
            ...(current.messages || []),
            {
              id: optimisticId,
              role: 'user',
              content: text,
              createdAt: new Date().toISOString(),
            },
          ],
          progress: {
            phase: 'understanding',
            percent: 5,
            message: 'Understanding your brief…',
            portalsTotal: 5,
            portalsDone: 0,
            listingsCollected: 0,
            duplicatesRemoved: 0,
            updatedAt: new Date().toISOString(),
          },
        };
      });

      pollProgress(id);

      const res = await fetch(`/api/research/ai/sessions/${id}/message`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Research failed');
      setSession(json.session);
      const lastAssistant = [...(json.session.messages || [])]
        .reverse()
        .find((m: { role: string }) => m.role === 'assistant');
      if (lastAssistant?.id) setAnimateAssistantId(lastAssistant.id);
      void loadSessions();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Research failed');
    } finally {
      if (pollRef.current) {
        window.clearInterval(pollRef.current);
        pollRef.current = null;
      }
      setBusy(false);
    }
  }

  async function newSession() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/research/ai/sessions', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Could not create session');
      setSession(json.session);
      setSessions((prev) => [json.session, ...prev]);
      setSelected([]);
      setComparison(null);
      setInput('');
      setAnimateAssistantId(null);
      textareaRef.current?.focus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setBusy(false);
    }
  }

  async function openSession(id: string) {
    if (busy || id === session?.id) return;
    setError(null);
    try {
      const res = await fetch(`/api/research/ai/sessions/${id}`, {
        credentials: 'include',
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Could not load session');
      setSession(json.session);
      setSelected([]);
      setComparison(null);
      setAnimateAssistantId(null);
      setCanvasOpenMobile(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  }

  async function runCompare() {
    if (!session?.id) return;
    const res = await fetch(`/api/research/ai/sessions/${session.id}/compare`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ listingIds: selected.length ? selected : undefined }),
    });
    const json = await res.json();
    if (res.ok) setComparison(json.comparison);
  }

  function onComposerKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void send();
  }

  const messages = session?.messages || [];
  const listings = session?.listings || [];
  const report = session?.report as ResearchReport | undefined;
  const hasConversation = messages.length > 0 || busy;
  const showCanvas = hasConversation || Boolean(report) || listings.length > 0;

  return (
    <div className="research-workspace flex min-h-[calc(100vh-7.5rem)] flex-col gap-3 xl:flex-row xl:gap-4">
      {/* Conversation history rail */}
      <aside className="research-panel hidden w-56 shrink-0 flex-col rounded-2xl p-3 lg:flex">
        <button
          type="button"
          onClick={() => void newSession()}
          disabled={busy}
          className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-slate-900 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50 dark:bg-orange-600 dark:hover:bg-orange-500"
        >
          <Plus className="h-3.5 w-3.5" />
          New research
        </button>

        <div className="mt-4 min-h-0 flex-1 space-y-4 overflow-y-auto">
          {groupedSessions.length === 0 ? (
            <p className="px-1 text-xs text-slate-500">No conversations yet.</p>
          ) : (
            groupedSessions.map(({ group, items }) => (
              <div key={group}>
                <p className="mb-1.5 px-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  {SESSION_GROUP_LABEL[group]}
                </p>
                <div className="space-y-1">
                  {items.map((s) => {
                    const active = s.id === session?.id;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => void openSession(s.id)}
                        className={`w-full rounded-xl px-2.5 py-2 text-left transition ${
                          active
                            ? 'bg-orange-50 text-orange-900 dark:bg-orange-950/50 dark:text-orange-100'
                            : 'text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800'
                        }`}
                      >
                        <span className="line-clamp-2 text-xs font-medium">
                          {s.title || 'Research'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          )}

          <div className="border-t border-slate-100 pt-3 dark:border-slate-800">
            <p className="mb-1.5 px-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Workspace
            </p>
            <div className="space-y-0.5">
              <Link
                href="/research/saved-searches"
                className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                <Bookmark className="h-3.5 w-3.5" />
                Saved Reports
              </Link>
              <Link
                href="/research/inventory"
                className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                <Search className="h-3.5 w-3.5" />
                Inventory Search
              </Link>
              <Link
                href="/research/watches"
                className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Watchlists
              </Link>
              <Link
                href="/research/knowledge"
                className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Knowledge Explorer
              </Link>
            </div>
          </div>
        </div>
      </aside>

      {/* Conversation column */}
      <section className="research-panel relative flex min-w-0 flex-1 flex-col overflow-hidden rounded-2xl">
        <div className="flex items-center justify-between gap-2 border-b border-slate-200/60 px-4 py-3.5 dark:border-slate-800/80">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-orange-600 text-white shadow-sm shadow-orange-600/30">
              <Sparkles className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-100">
                Executive Mumbai Research Analyst
              </p>
              <p className="truncate text-[11px] text-slate-500">
                {busy
                  ? session?.progress?.message || 'Working across portals…'
                  : 'Calm, focused research for Mumbai real estate'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {showCanvas ? (
              <button
                type="button"
                onClick={() => setCanvasOpenMobile((v) => !v)}
                className="inline-flex h-8 items-center rounded-lg border border-slate-200 px-2.5 text-xs font-medium text-slate-700 xl:hidden dark:border-slate-700 dark:text-slate-200"
              >
                Canvas
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => void newSession()}
              className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 px-2.5 text-xs font-medium text-slate-700 hover:bg-white lg:hidden dark:border-slate-700 dark:text-slate-200"
            >
              <Plus className="h-3.5 w-3.5" />
              New
            </button>
          </div>
        </div>

        <div ref={scrollRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto px-3 py-4 sm:px-6">
          {!hasConversation ? (
            <ResearchFadeUp className="mx-auto flex max-w-2xl flex-col items-center px-2 pb-12 pt-10 text-center sm:pt-20">
              <div className="mb-6 inline-flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-orange-500 to-amber-600 text-white shadow-xl shadow-orange-600/25">
                <Sparkles className="h-8 w-8" />
              </div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-orange-600/80">
                Prop / Research
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-50 sm:text-[2.5rem] sm:leading-tight">
                What should we research today?
              </h2>
              <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-slate-500 dark:text-slate-400">
                You’re speaking with an executive Mumbai real estate research analyst — portals,
                owner vs broker, pricing, and negotiation in one conversation.
              </p>

              {sessions.length > 0 ? (
                <div className="mt-8 w-full text-left">
                  <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Recent conversations
                  </p>
                  <div className="grid gap-2.5 sm:grid-cols-2">
                    {sessions.slice(0, 4).map((s, i) => (
                      <ResearchFadeUp key={s.id} delay={0.04 * i}>
                        <button
                          type="button"
                          onClick={() => void openSession(s.id)}
                          className="w-full rounded-2xl border border-slate-200/80 bg-white/90 px-3.5 py-3.5 text-left text-sm text-slate-700 shadow-sm transition hover:border-orange-300 hover:bg-orange-50/40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                        >
                          <span className="line-clamp-2 font-medium">{s.title || 'Research'}</span>
                        </button>
                      </ResearchFadeUp>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="mt-10 grid w-full gap-2.5 sm:grid-cols-2">
                {RESEARCH_SUGGESTED_PROMPTS.map((prompt, i) => (
                  <ResearchFadeUp key={prompt} delay={0.05 + i * 0.04}>
                    <button
                      type="button"
                      onClick={() => void send(prompt)}
                      className="w-full rounded-2xl border border-slate-200/80 bg-white/90 px-3.5 py-3.5 text-left text-sm text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:border-orange-300 hover:bg-orange-50/50 hover:shadow-md dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-orange-700"
                    >
                      {prompt}
                    </button>
                  </ResearchFadeUp>
                ))}
              </div>

              <div className="mt-8 flex flex-wrap justify-center gap-2 text-[11px] text-slate-500">
                <Link href="/research/inventory" className="rounded-full border border-slate-200/90 px-3 py-1.5 hover:bg-white dark:border-slate-700">
                  Inventory Search
                </Link>
                <Link href="/research/connectors" className="rounded-full border border-slate-200/90 px-3 py-1.5 hover:bg-white dark:border-slate-700">
                  Connectors
                </Link>
                <Link href="/research/knowledge" className="rounded-full border border-slate-200/90 px-3 py-1.5 hover:bg-white dark:border-slate-700">
                  Knowledge Explorer
                </Link>
              </div>
            </ResearchFadeUp>
          ) : (
            <div className="mx-auto max-w-3xl space-y-5">
              {messages.map((m) => {
                const isUser = m.role === 'user';
                return (
                  <ResearchMessageMotion key={m.id} fromUser={isUser}>
                    <div
                      className={`max-w-[92%] rounded-2xl px-4 py-3.5 text-[15px] leading-relaxed shadow-sm sm:max-w-[88%] ${
                        isUser
                          ? 'rounded-br-md bg-slate-900 text-white dark:bg-orange-600'
                          : 'rounded-bl-md border border-slate-200/70 bg-white/95 text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100'
                      }`}
                    >
                      {!isUser ? (
                        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-orange-600 dark:text-orange-400">
                          Analyst
                        </p>
                      ) : null}
                      {isUser ? (
                        m.content
                      ) : (
                        <TypewriterMarkdown
                          text={m.content}
                          active={animateAssistantId === m.id}
                        />
                      )}
                    </div>
                  </ResearchMessageMotion>
                );
              })}

              <AnimatePresence>
              {busy || liveSteps.length > 0 ? (
                <ResearchLivePanel className="rounded-2xl border border-orange-200/60 bg-white/95 p-4 shadow-sm dark:border-orange-900/40 dark:bg-slate-900/95">
                  <div className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-800 dark:text-slate-100">
                    <span className="research-live-dot" />
                    Live research timeline
                    {session?.progress?.percent != null ? (
                      <span className="ml-auto text-xs font-normal text-slate-400">
                        {session.progress.percent}%
                      </span>
                    ) : null}
                  </div>
                  {session?.progress?.message ? (
                    <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">
                      {session.progress.message}
                      {session.progress.listingsCollected
                        ? ` · ${session.progress.listingsCollected} listings collected`
                        : ''}
                    </p>
                  ) : null}
                  {session?.progress?.percent != null ? (
                    <div className="research-progress-track mb-3">
                      <div
                        className="research-progress-bar"
                        style={{ width: `${Math.max(8, Math.min(100, session.progress.percent))}%` }}
                      />
                    </div>
                  ) : null}
                  <ul className="max-h-64 space-y-2 overflow-y-auto">
                    {liveSteps.length > 0 ? (
                      liveSteps.map((step) => (
                      <li key={step.id} className="flex items-center gap-2.5 text-sm">
                        <span
                          className={`flex h-5 w-5 items-center justify-center rounded-full ${
                            step.status === 'done'
                              ? 'bg-emerald-100 text-emerald-700'
                              : step.status === 'fail'
                                ? 'bg-rose-100 text-rose-700'
                                : step.status === 'active'
                                  ? 'bg-orange-100 text-orange-700'
                                  : 'bg-slate-100 text-slate-400'
                          }`}
                        >
                          {step.status === 'done' ? (
                            <Check className="h-3 w-3" />
                          ) : step.status === 'fail' ? (
                            <span className="text-[10px] font-bold">!</span>
                          ) : step.status === 'active' ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <span className="h-1.5 w-1.5 rounded-full bg-current" />
                          )}
                        </span>
                        <span
                          className={
                            step.status === 'pending'
                              ? 'text-slate-400'
                              : step.status === 'fail'
                                ? 'text-rose-700 dark:text-rose-300'
                                : 'text-slate-700 dark:text-slate-200'
                          }
                        >
                          {step.label}
                        </span>
                      </li>
                      ))
                    ) : busy ? (
                      <li className="flex items-center gap-2.5 text-sm text-slate-500">
                        <Loader2 className="h-4 w-4 animate-spin text-orange-600" />
                        Waiting for research activity…
                      </li>
                    ) : null}
                  </ul>
                </ResearchLivePanel>
              ) : null}
              </AnimatePresence>

              {listings.length > 0 && !busy ? (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      Matching properties
                    </h3>
                    <button
                      type="button"
                      onClick={() => void runCompare()}
                      className="h-8 rounded-lg border border-slate-200 px-3 text-xs font-medium text-slate-700 hover:bg-white dark:border-slate-700 dark:text-slate-200"
                    >
                      Compare selected
                    </button>
                  </div>
                  <div className="grid gap-3">
                    {listings.slice(0, 20).map((listing: ResearchScoredListing) => (
                      <PropertyCard
                        key={listing.id}
                        listing={listing}
                        selected={selected.includes(listing.id)}
                        onToggleSelect={(id, next) => {
                          setSelected((prev) =>
                            next ? [...prev, id] : prev.filter((x) => x !== id),
                          );
                        }}
                      />
                    ))}
                  </div>
                </div>
              ) : null}

              {comparison ? (
                <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    Comparison
                  </h3>
                  <div className="mt-3 overflow-x-auto">
                    <table className="min-w-full text-left text-sm">
                      <tbody>
                        {comparison.rows.map((row) => (
                          <tr
                            key={row.attribute}
                            className="border-b border-slate-100 dark:border-slate-800"
                          >
                            <th className="py-2 pr-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
                              {row.attribute}
                            </th>
                            {row.values.map((v, i) => (
                              <td key={`${row.attribute}-${i}`} className="py-2 pr-3">
                                {v ?? '—'}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}

              {report && !busy ? (
                <ExecutiveReportPanel
                  report={report}
                  listings={listings}
                  sessionId={session?.id}
                />
              ) : null}
            </div>
          )}
        </div>

        {/* Sticky composer */}
        <div className="sticky bottom-0 border-t border-slate-200/80 bg-white/90 p-3 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95 sm:p-4">
          {error ? (
            <p className="mb-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-100">
              {error}
            </p>
          ) : null}
          <div className="mx-auto max-w-3xl space-y-2.5">
            <ConnectorStatusChips />
            <form onSubmit={onSubmit}>
              <div className="flex items-end gap-2 research-composer rounded-2xl border border-slate-200/80 bg-white p-2 transition dark:border-slate-700 dark:bg-slate-900">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={onComposerKeyDown}
                  rows={1}
                  disabled={busy}
                  placeholder="Ask your Mumbai research analyst…"
                  className="max-h-36 min-h-[48px] flex-1 resize-none bg-transparent px-2 py-3 text-[15px] text-slate-900 outline-none placeholder:text-slate-400 disabled:opacity-60 dark:text-slate-100"
                />
                <button
                  type="submit"
                  disabled={busy || !input.trim()}
                  aria-label="Send"
                  className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-orange-600 text-white transition hover:bg-orange-500 disabled:opacity-40"
                >
                  {busy ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ArrowUp className="h-4 w-4" />
                  )}
                </button>
              </div>
              <p className="mt-1.5 text-center text-[10px] text-slate-400">
                Enter to send · Shift+Enter for new line
              </p>
            </form>
          </div>
        </div>
      </section>

      {/* Desktop canvas */}
      {showCanvas ? (
        <div className="hidden w-[380px] shrink-0 xl:block 2xl:w-[420px]">
          <ResearchCanvas
            busy={busy}
            progress={session?.progress}
            liveSteps={liveSteps}
            listings={listings}
            report={report}
          />
        </div>
      ) : null}

      {/* Mobile canvas drawer */}
      {showCanvas && canvasOpenMobile ? (
        <div className="fixed inset-0 z-40 xl:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/40"
            aria-label="Close canvas"
            onClick={() => setCanvasOpenMobile(false)}
          />
          <div className="absolute inset-y-0 right-0 w-full max-w-md p-3">
            <ResearchCanvas
              busy={busy}
              progress={session?.progress}
              liveSteps={liveSteps}
              listings={listings}
              report={report}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
