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
import {
  ArrowUp,
  Check,
  FileSpreadsheet,
  FileText,
  Loader2,
  Plus,
  Sparkles,
} from 'lucide-react';
import { DEFAULT_RESEARCH_WORKSPACE } from '@/lib/research/business';
import type {
  ResearchAiProgress,
  ResearchAiSession,
  ResearchReport,
  ResearchScoredListing,
} from '@/lib/research/types';

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

type LiveStep = {
  id: string;
  label: string;
  status: 'pending' | 'active' | 'done';
};

const SUGGESTED_PROMPTS = [
  'Find 2 BHK rentals below ₹80,000 in Oberoi Sky City',
  'Compare owner vs broker listings for 3 BHK in Andheri West',
  'Which portals have the best inventory in Powai this week?',
  'Fully furnished 2 BHK near BKC under ₹1.2L — exclude east-facing',
];

function money(n?: number): string {
  if (n == null) return '—';
  return `₹${n.toLocaleString('en-IN')}`;
}

function buildLiveSteps(progress: ResearchAiProgress | null | undefined, busy: boolean): LiveStep[] {
  if (!busy && (!progress || progress.phase === 'idle' || progress.phase === 'completed')) {
    return [];
  }
  const phase = progress?.phase || 'understanding';
  const portalsDone = progress?.portalsDone ?? 0;
  const portalsTotal = Math.max(progress?.portalsTotal ?? 5, 1);
  const message = (progress?.message || '').toLowerCase();

  const portalLabels = ['Housing.com', 'MagicBricks', '99acres', 'NoBroker', 'Square Yards'];
  const steps: LiveStep[] = [
    {
      id: 'understand',
      label: 'Understanding your brief…',
      status: phase === 'understanding' || phase === 'planning' ? 'active' : 'done',
    },
  ];

  portalLabels.forEach((name, index) => {
    let status: LiveStep['status'] = 'pending';
    if (phase === 'searching') {
      if (index < portalsDone) status = 'done';
      else if (index === portalsDone) status = 'active';
    } else if (
      phase === 'analyzing' ||
      phase === 'reporting' ||
      phase === 'completed'
    ) {
      status = 'done';
    }
    steps.push({ id: `portal-${name}`, label: `Searching ${name}…`, status });
  });

  const afterSearch =
    phase === 'analyzing' || phase === 'reporting' || phase === 'completed'
      ? 'active'
      : phase === 'searching' && portalsDone >= portalsTotal
        ? 'active'
        : 'pending';

  steps.push({
    id: 'dedupe',
    label: 'Removing duplicates…',
    status:
      /dedup|duplicate/i.test(message) || phase === 'analyzing'
        ? afterSearch === 'active'
          ? 'active'
          : phase === 'reporting' || phase === 'completed'
            ? 'done'
            : 'pending'
        : phase === 'reporting' || phase === 'completed'
          ? 'done'
          : 'pending',
  });
  steps.push({
    id: 'compare',
    label: 'Comparing prices…',
    status:
      phase === 'analyzing' && /score|compar|price|knowledge/i.test(message)
        ? 'active'
        : phase === 'reporting' || phase === 'completed'
          ? 'done'
          : 'pending',
  });
  steps.push({
    id: 'history',
    label: 'Checking historical records…',
    status:
      /knowledge graph|historical|graph/i.test(message)
        ? 'active'
        : phase === 'reporting' || phase === 'completed'
          ? 'done'
          : 'pending',
  });
  steps.push({
    id: 'intel',
    label: 'Building market intelligence…',
    status:
      phase === 'reporting'
        ? 'active'
        : phase === 'completed'
          ? 'done'
          : 'pending',
  });
  steps.push({
    id: 'exec',
    label: 'Preparing executive summary…',
    status: phase === 'completed' ? 'done' : phase === 'reporting' ? 'active' : 'pending',
  });

  // Ensure exactly one active when busy
  if (busy) {
    const firstPending = steps.findIndex((s) => s.status === 'pending');
    const hasActive = steps.some((s) => s.status === 'active');
    if (!hasActive && firstPending >= 0) {
      steps[firstPending] = { ...steps[firstPending], status: 'active' };
    }
  }

  return steps;
}

function TypewriterText({ text, active }: { text: string; active: boolean }) {
  const [shown, setShown] = useState(active ? '' : text);

  useEffect(() => {
    if (!active) {
      setShown(text);
      return;
    }
    setShown('');
    let i = 0;
    const id = window.setInterval(() => {
      i += Math.max(1, Math.ceil(text.length / 80));
      setShown(text.slice(0, i));
      if (i >= text.length) window.clearInterval(id);
    }, 18);
    return () => window.clearInterval(id);
  }, [text, active]);

  return (
    <span className="whitespace-pre-wrap">
      {shown}
      {active && shown.length < text.length ? (
        <span className="ml-0.5 inline-block h-4 w-1 animate-pulse bg-current align-middle opacity-60" />
      ) : null}
    </span>
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
  const [comparison, setComparison] = useState<{
    rows: Array<{ attribute: string; values: Array<string | number | undefined> }>;
    strengths: Record<string, string[]>;
    weaknesses: Record<string, string[]>;
  } | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const pollRef = useRef<number | null>(null);

  const liveSteps = useMemo(
    () => buildLiveSteps(session?.progress, busy),
    [session?.progress, busy],
  );

  const loadSessions = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/research/ai/sessions?workspaceId=${encodeURIComponent(workspaceId)}`,
        { credentials: 'include' },
      );
      const json = await res.json();
      if (res.ok && Array.isArray(json.sessions)) {
        setSessions(json.sessions);
        setSession((current) => current || json.sessions[0] || null);
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

  const ensureSession = useCallback(async (): Promise<string> => {
    if (session?.id) return session.id;
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
    return json.session.id as string;
  }, [session?.id, workspaceId]);

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
            // Keep optimistic user bubble if messages temporarily lag
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

    try {
      const id = await ensureSession();

      const optimisticId = `local-user-${Date.now()}`;
      setSession((prev) =>
        prev
          ? {
              ...prev,
              messages: [
                ...prev.messages,
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
            }
          : prev,
      );

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

  return (
    <div className="flex min-h-[calc(100vh-8.5rem)] flex-col gap-3 lg:flex-row lg:gap-4">
      {/* Session rail */}
      <aside className="hidden w-56 shrink-0 flex-col rounded-2xl border border-slate-200/80 bg-white/80 p-3 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/80 lg:flex">
        <button
          type="button"
          onClick={() => void newSession()}
          disabled={busy}
          className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-slate-900 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50 dark:bg-orange-600 dark:hover:bg-orange-500"
        >
          <Plus className="h-3.5 w-3.5" />
          New research
        </button>
        <p className="mb-2 mt-4 px-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          History
        </p>
        <div className="min-h-0 flex-1 space-y-1 overflow-y-auto">
          {sessions.length === 0 ? (
            <p className="px-1 text-xs text-slate-500">No sessions yet.</p>
          ) : (
            sessions.map((s) => {
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
                  <span className="line-clamp-2 text-xs font-medium">{s.title || 'Research'}</span>
                  <span className="mt-0.5 block text-[10px] text-slate-400">
                    {new Date(s.updatedAt || s.createdAt).toLocaleString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </button>
              );
            })
          )}
        </div>
      </aside>

      {/* Conversation stage */}
      <section className="relative flex min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-gradient-to-b from-white via-slate-50/80 to-slate-100/90 shadow-sm dark:border-slate-800 dark:from-slate-900 dark:via-slate-950 dark:to-slate-950">
        <div className="flex items-center justify-between gap-2 border-b border-slate-200/70 px-4 py-3 dark:border-slate-800">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-orange-600 text-white shadow-sm">
                <Sparkles className="h-3.5 w-3.5" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Mumbai Real Estate Research Analyst
                </p>
                <p className="truncate text-[11px] text-slate-500">
                  {busy
                    ? session?.progress?.message || 'Working across portals…'
                    : 'Ask in plain language — portals, prices, history'}
                </p>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void newSession()}
            className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 px-2.5 text-xs font-medium text-slate-700 hover:bg-white lg:hidden dark:border-slate-700 dark:text-slate-200"
          >
            <Plus className="h-3.5 w-3.5" />
            New
          </button>
        </div>

        <div ref={scrollRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto px-3 py-4 sm:px-5">
          {!hasConversation ? (
            <div className="mx-auto flex max-w-2xl flex-col items-center px-2 pb-8 pt-6 text-center sm:pt-12">
              <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-600 text-white shadow-lg shadow-orange-600/25">
                <Sparkles className="h-7 w-7" />
              </div>
              <h2 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-50 sm:text-3xl">
                What should we research?
              </h2>
              <p className="mt-2 max-w-lg text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                Talk like you would to a senior Mumbai property analyst. I search Housing,
                MagicBricks, 99acres and more, then compare and brief you.
              </p>
              <div className="mt-8 grid w-full gap-2 sm:grid-cols-2">
                {SUGGESTED_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => void send(prompt)}
                    className="rounded-2xl border border-slate-200/90 bg-white/90 px-3.5 py-3 text-left text-sm text-slate-700 shadow-sm transition hover:border-orange-300 hover:bg-orange-50/60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-orange-700 dark:hover:bg-orange-950/30"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="mx-auto max-w-3xl space-y-4">
              {messages.map((m) => {
                const isUser = m.role === 'user';
                return (
                  <div
                    key={m.id}
                    className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[92%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm sm:max-w-[85%] ${
                        isUser
                          ? 'rounded-br-md bg-slate-900 text-white dark:bg-orange-600'
                          : 'rounded-bl-md border border-slate-200/80 bg-white text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100'
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
                        <TypewriterText
                          text={m.content}
                          active={animateAssistantId === m.id}
                        />
                      )}
                    </div>
                  </div>
                );
              })}

              {busy || liveSteps.length > 0 ? (
                <div className="rounded-2xl border border-slate-200/80 bg-white/95 p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/95">
                  <div className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-800 dark:text-slate-100">
                    <Loader2 className="h-4 w-4 animate-spin text-orange-600" />
                    Live research
                    {session?.progress?.percent != null ? (
                      <span className="ml-auto text-xs font-normal text-slate-400">
                        {session.progress.percent}%
                      </span>
                    ) : null}
                  </div>
                  <ul className="space-y-2">
                    {liveSteps.map((step) => (
                      <li key={step.id} className="flex items-center gap-2.5 text-sm">
                        <span
                          className={`flex h-5 w-5 items-center justify-center rounded-full ${
                            step.status === 'done'
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                              : step.status === 'active'
                                ? 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300'
                                : 'bg-slate-100 text-slate-400 dark:bg-slate-800'
                          }`}
                        >
                          {step.status === 'done' ? (
                            <Check className="h-3 w-3" />
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
                              : 'text-slate-700 dark:text-slate-200'
                          }
                        >
                          {step.label}
                        </span>
                      </li>
                    ))}
                  </ul>
                  {session?.progress ? (
                    <dl className="mt-4 grid grid-cols-3 gap-2 border-t border-slate-100 pt-3 text-[11px] text-slate-500 dark:border-slate-800">
                      <div>
                        <dt className="uppercase tracking-wide">Portals</dt>
                        <dd className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                          {session.progress.portalsDone}/{session.progress.portalsTotal || '—'}
                        </dd>
                      </div>
                      <div>
                        <dt className="uppercase tracking-wide">Listings</dt>
                        <dd className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                          {session.progress.listingsCollected}
                        </dd>
                      </div>
                      <div>
                        <dt className="uppercase tracking-wide">Deduped</dt>
                        <dd className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                          {session.progress.duplicatesRemoved}
                        </dd>
                      </div>
                    </dl>
                  ) : null}
                </div>
              ) : null}

              {listings.length > 0 && !busy ? (
                <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3 dark:border-slate-800">
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      Ranked matches
                    </h3>
                    <button
                      type="button"
                      onClick={() => void runCompare()}
                      className="h-8 rounded-lg border border-slate-200 px-3 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200"
                    >
                      Compare selected
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-left text-sm">
                      <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500 dark:bg-slate-950/50">
                        <tr>
                          <th className="px-3 py-2" />
                          <th className="px-3 py-2">Score</th>
                          <th className="px-3 py-2">Listing</th>
                          <th className="px-3 py-2">Price</th>
                          <th className="px-3 py-2">Why</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {listings.slice(0, 20).map((listing: ResearchScoredListing) => (
                          <tr key={listing.id}>
                            <td className="px-3 py-2">
                              <input
                                type="checkbox"
                                checked={selected.includes(listing.id)}
                                onChange={(e) => {
                                  setSelected((prev) =>
                                    e.target.checked
                                      ? [...prev, listing.id]
                                      : prev.filter((id) => id !== listing.id),
                                  );
                                }}
                              />
                            </td>
                            <td className="px-3 py-2 font-semibold">{listing.relevanceScore}</td>
                            <td className="px-3 py-2">
                              <div className="font-medium text-slate-900 dark:text-slate-100">
                                {listing.title || 'Listing'}
                              </div>
                              <div className="text-xs text-slate-500">
                                {(listing.portalRefs || [])
                                  .map((p) => p.portal)
                                  .join(', ') || listing.portal}
                              </div>
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap">
                              {money(listing.rent ?? listing.salePrice)}
                            </td>
                            <td className="max-w-[240px] px-3 py-2 text-xs text-slate-600 dark:text-slate-300">
                              {listing.explanation}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
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
                <div className="rounded-2xl border border-slate-200/80 bg-white p-4 text-sm shadow-sm dark:border-slate-700 dark:bg-slate-900">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                      Executive briefing
                    </h3>
                    {session?.id ? (
                      <div className="flex flex-wrap gap-1.5">
                        <a
                          href={`/api/research/ai/sessions/${session.id}/export?format=pdf`}
                          className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200"
                        >
                          <FileText className="h-3.5 w-3.5" />
                          PDF
                        </a>
                        <a
                          href={`/api/research/ai/sessions/${session.id}/export?format=excel`}
                          className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200"
                        >
                          <FileSpreadsheet className="h-3.5 w-3.5" />
                          Excel
                        </a>
                        <a
                          href={`/api/research/ai/sessions/${session.id}/export?format=csv`}
                          className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200"
                        >
                          CSV
                        </a>
                      </div>
                    ) : null}
                  </div>
                  <p className="mt-2 leading-relaxed text-slate-700 dark:text-slate-200">
                    {report.executiveSummary}
                  </p>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <div>
                      <h4 className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                        Observations
                      </h4>
                      <ul className="mt-1 space-y-1 text-slate-600 dark:text-slate-300">
                        {report.observations.map((o) => (
                          <li key={o}>• {o}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <h4 className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                        Next steps
                      </h4>
                      <ul className="mt-1 space-y-1 text-slate-600 dark:text-slate-300">
                        {report.recommendedNextSteps.map((o) => (
                          <li key={o}>• {o}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                  {report.warnings.length ? (
                    <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100">
                      {report.warnings.join(' ')}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          )}
        </div>

        {/* Sticky composer */}
        <div className="sticky bottom-0 border-t border-slate-200/80 bg-white/95 p-3 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95 sm:p-4">
          {error ? (
            <p className="mb-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-100">
              {error}
            </p>
          ) : null}
          <form onSubmit={onSubmit} className="mx-auto max-w-3xl">
            <div className="flex items-end gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-lg shadow-slate-900/5 dark:border-slate-700 dark:bg-slate-900 dark:shadow-black/30">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onComposerKeyDown}
                rows={1}
                disabled={busy}
                placeholder="Ask your Mumbai research analyst…"
                className="max-h-36 min-h-[44px] flex-1 resize-none bg-transparent px-2 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 disabled:opacity-60 dark:text-slate-100"
              />
              <button
                type="submit"
                disabled={busy || !input.trim()}
                aria-label="Send"
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-600 text-white transition hover:bg-orange-500 disabled:opacity-40"
              >
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ArrowUp className="h-4 w-4" />
                )}
              </button>
            </div>
            <p className="mt-1.5 text-center text-[10px] text-slate-400">
              Enter to send · Shift+Enter for new line · Live portal search may take a minute
            </p>
          </form>
        </div>
      </section>
    </div>
  );
}
