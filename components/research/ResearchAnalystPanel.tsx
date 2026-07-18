'use client';

import { useCallback, useEffect, useState } from 'react';
import { DEFAULT_RESEARCH_WORKSPACE } from '@/lib/research/business';
import type {
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
>;

function money(n?: number): string {
  if (n == null) return '—';
  return `₹${n.toLocaleString('en-IN')}`;
}

export default function ResearchAnalystPanel() {
  const workspaceId = DEFAULT_RESEARCH_WORKSPACE.id;
  const [session, setSession] = useState<PublicSession | null>(null);
  const [input, setInput] = useState(
    'Find 2 BHK rentals below ₹80,000 in Oberoi Sky City.',
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [comparison, setComparison] = useState<{
    rows: Array<{ attribute: string; values: Array<string | number | undefined> }>;
    strengths: Record<string, string[]>;
    weaknesses: Record<string, string[]>;
  } | null>(null);

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
    return json.session.id as string;
  }, [session?.id, workspaceId]);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch(
          `/api/research/ai/sessions?workspaceId=${encodeURIComponent(workspaceId)}`,
          { credentials: 'include' },
        );
        const json = await res.json();
        if (res.ok && json.sessions?.[0]) setSession(json.sessions[0]);
      } catch {
        /* ignore */
      }
    })();
  }, [workspaceId]);

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    setBusy(true);
    setError(null);
    setComparison(null);
    try {
      const id = await ensureSession();
      const res = await fetch(`/api/research/ai/sessions/${id}/message`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Research failed');
      setSession(json.session);
      setInput('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Research failed');
    } finally {
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
      setSelected([]);
      setComparison(null);
      setInput('Find 2 BHK rentals below ₹80,000 in Oberoi Sky City.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setBusy(false);
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

  const progress = session?.progress;
  const listings = session?.listings || [];
  const report = session?.report as ResearchReport | undefined;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Executive research analyst
          </p>
          <p className="text-xs text-slate-500">
            Delegate research in plain language. Follow-ups refine the same session.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void newSession()}
          className="h-8 rounded-md border border-slate-200 px-3 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200"
        >
          New session
        </button>
      </div>

      {progress && progress.phase !== 'idle' ? (
        <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="font-medium text-slate-800 dark:text-slate-100">{progress.message}</span>
            <span className="text-xs uppercase tracking-wide text-slate-500">
              {progress.phase} · {progress.percent}%
            </span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div
              className="h-full rounded-full bg-slate-900 transition-all dark:bg-slate-100"
              style={{ width: `${progress.percent}%` }}
            />
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-600 sm:grid-cols-4 dark:text-slate-300">
            <div>
              <dt className="uppercase tracking-wide text-slate-400">Portals</dt>
              <dd>
                {progress.portalsDone}/{progress.portalsTotal}
              </dd>
            </div>
            <div>
              <dt className="uppercase tracking-wide text-slate-400">Listings</dt>
              <dd>{progress.listingsCollected}</dd>
            </div>
            <div>
              <dt className="uppercase tracking-wide text-slate-400">Duplicates removed</dt>
              <dd>{progress.duplicatesRemoved}</dd>
            </div>
            <div>
              <dt className="uppercase tracking-wide text-slate-400">Confidence</dt>
              <dd>{report?.researchConfidence ?? '—'}/100</dd>
            </div>
          </dl>
        </div>
      ) : null}

      <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="max-h-72 space-y-3 overflow-y-auto">
          {(session?.messages || []).length === 0 ? (
            <p className="text-sm text-slate-500">
              Example: “Find 2 BHK rentals below ₹80,000 in Oberoi Sky City.” Then refine with
              “Only fully furnished” or “Exclude east-facing.”
            </p>
          ) : (
            session?.messages.map((m) => (
              <div
                key={m.id}
                className={`rounded-md px-3 py-2 text-sm ${
                  m.role === 'user'
                    ? 'ml-8 bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                    : 'mr-8 bg-slate-50 text-slate-800 dark:bg-slate-950 dark:text-slate-100'
                }`}
              >
                {m.content}
              </div>
            ))
          )}
        </div>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          rows={3}
          disabled={busy}
          className="mt-3 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          placeholder="Ask your research analyst…"
        />
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy || !input.trim()}
            onClick={() => void send()}
            className="inline-flex h-9 items-center rounded-md bg-slate-900 px-3 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900"
          >
            {busy ? 'Researching…' : 'Send'}
          </button>
          {session?.id && report ? (
            <>
              <a
                href={`/api/research/ai/sessions/${session.id}/export?format=pdf`}
                className="inline-flex h-9 items-center rounded-md border border-slate-200 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200"
              >
                PDF report
              </a>
              <a
                href={`/api/research/ai/sessions/${session.id}/export?format=excel`}
                className="inline-flex h-9 items-center rounded-md border border-slate-200 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200"
              >
                Excel
              </a>
              <a
                href={`/api/research/ai/sessions/${session.id}/export?format=csv`}
                className="inline-flex h-9 items-center rounded-md border border-slate-200 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200"
              >
                CSV
              </a>
            </>
          ) : null}
        </div>
        {error ? (
          <p className="mt-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
            {error}
          </p>
        ) : null}
      </div>

      {session?.filters && (session.goals.length > 0 || session.exclusions.length > 0) ? (
        <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm dark:border-slate-800 dark:bg-slate-900">
          <h3 className="font-semibold text-slate-900 dark:text-slate-100">Session memory</h3>
          <ul className="mt-2 space-y-1 text-slate-600 dark:text-slate-300">
            {session.goals.slice(-6).map((g) => (
              <li key={g}>• {g}</li>
            ))}
            {session.exclusions.map((ex) => (
              <li key={ex}>• Exclusion: {ex}</li>
            ))}
            {session.assumptions.map((a) => (
              <li key={a}>• Assumption: {a}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {listings.length > 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Ranked matches
            </h3>
            <button
              type="button"
              onClick={() => void runCompare()}
              className="h-8 rounded-md border border-slate-200 px-3 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200"
            >
              Compare selected
            </button>
          </div>
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="py-2 pr-2" />
                  <th className="py-2 pr-3">Score</th>
                  <th className="py-2 pr-3">Title</th>
                  <th className="py-2 pr-3">Price</th>
                  <th className="py-2 pr-3">Why</th>
                </tr>
              </thead>
              <tbody>
                {listings.slice(0, 20).map((listing: ResearchScoredListing) => (
                  <tr key={listing.id} className="border-b border-slate-100 dark:border-slate-800">
                    <td className="py-2 pr-2">
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
                    <td className="py-2 pr-3 font-semibold">{listing.relevanceScore}</td>
                    <td className="py-2 pr-3">
                      <div className="font-medium text-slate-900 dark:text-slate-100">
                        {listing.title || 'Listing'}
                      </div>
                      <div className="text-xs text-slate-500">
                        {(listing.portalRefs || []).map((p) => p.portal).join(', ') || listing.portal}
                      </div>
                    </td>
                    <td className="py-2 pr-3">{money(listing.rent ?? listing.salePrice)}</td>
                    <td className="py-2 pr-3 text-xs text-slate-600 dark:text-slate-300">
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
        <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Comparison</h3>
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <tbody>
                {comparison.rows.map((row) => (
                  <tr key={row.attribute} className="border-b border-slate-100 dark:border-slate-800">
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

      {report ? (
        <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm dark:border-slate-800 dark:bg-slate-900">
          <h3 className="font-semibold text-slate-900 dark:text-slate-100">Client research report</h3>
          <p className="mt-2 text-slate-700 dark:text-slate-200">{report.executiveSummary}</p>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Observations
              </h4>
              <ul className="mt-1 space-y-1 text-slate-600 dark:text-slate-300">
                {report.observations.map((o) => (
                  <li key={o}>• {o}</li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
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
            <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900">
              {report.warnings.join(' ')}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
