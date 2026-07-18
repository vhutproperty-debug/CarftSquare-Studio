'use client';

import { useState } from 'react';
import { DEFAULT_RESEARCH_WORKSPACE } from '@/lib/research/business';
import type {
  ResearchListing,
  ResearchPlanSnapshot,
  ResearchQuery,
  ResearchRun,
} from '@/lib/research/types';

function formatMoney(n?: number): string {
  if (n == null) return '—';
  return `₹${n.toLocaleString('en-IN')}`;
}

export default function ResearchRunner() {
  const workspaceId = DEFAULT_RESEARCH_WORKSPACE.id;
  const [query, setQuery] = useState('2 BHK rent Oberoi Sky City below 80000');
  const [busy, setBusy] = useState<'plan' | 'run' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [plan, setPlan] = useState<ResearchPlanSnapshot | null>(null);
  const [savedQuery, setSavedQuery] = useState<ResearchQuery | null>(null);
  const [run, setRun] = useState<ResearchRun | null>(null);
  const [listings, setListings] = useState<ResearchListing[]>([]);

  async function planOnly() {
    setBusy('plan');
    setError(null);
    try {
      const res = await fetch('/api/research/plan', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId, naturalLanguage: query }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Plan failed');
      setPlan(json.plan);
      setSavedQuery(json.query);
      setRun(null);
      setListings([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Plan failed');
    } finally {
      setBusy(null);
    }
  }

  async function runResearch() {
    setBusy('run');
    setError(null);
    try {
      const res = await fetch('/api/research/runs', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId,
          naturalLanguage: query,
          queryId: savedQuery?.id,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Run failed');
      setRun(json.run);
      setListings(json.listings || []);
      if (json.result?.payload?.criteria) {
        setPlan({
          criteria: json.result.payload.criteria,
          steps: savedQuery?.plan?.steps || [],
          interpretedAs: json.result.payload.interpretedAs || [],
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Run failed');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <label className="block text-sm font-medium text-slate-800 dark:text-slate-100">
          Research query
        </label>
        <textarea
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          rows={3}
          className="mt-2 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          placeholder='e.g. "2 BHK rent Oberoi Sky City below 80000"'
        />
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!!busy || !query.trim()}
            onClick={() => void planOnly()}
            className="inline-flex h-9 items-center rounded-md border border-slate-200 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200"
          >
            {busy === 'plan' ? 'Planning…' : 'Build plan'}
          </button>
          <button
            type="button"
            disabled={!!busy || !query.trim()}
            onClick={() => void runResearch()}
            className="inline-flex h-9 items-center rounded-md bg-slate-900 px-3 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900"
          >
            {busy === 'run' ? 'Running…' : 'Run research'}
          </button>
        </div>
      </div>

      {error ? (
        <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error}
        </p>
      ) : null}

      {plan ? (
        <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Research plan</h3>
          <ul className="mt-2 space-y-1 text-sm text-slate-600 dark:text-slate-300">
            {plan.interpretedAs.map((line) => (
              <li key={line}>• {line}</li>
            ))}
          </ul>
          <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-400">Project</dt>
              <dd className="font-medium">{plan.criteria.project || '—'}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-400">Budget</dt>
              <dd className="font-medium">
                {plan.criteria.minBudget != null || plan.criteria.maxBudget != null
                  ? `${formatMoney(plan.criteria.minBudget)} – ${formatMoney(plan.criteria.maxBudget)}`
                  : '—'}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-400">BHK</dt>
              <dd className="font-medium">{plan.criteria.bhk ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-400">Transaction</dt>
              <dd className="font-medium">{plan.criteria.transactionType || '—'}</dd>
            </div>
          </dl>
          <p className="mt-3 text-xs text-slate-500">
            {plan.steps.length} execution steps across {(plan.criteria.portals || []).join(', ')}
          </p>
        </div>
      ) : null}

      {run ? (
        <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Run result</h3>
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
              {run.status} · {run.listingCount ?? listings.length} listings
            </span>
          </div>
          {run.errorMessage ? (
            <p className="mt-2 text-sm text-rose-700">{run.errorMessage}</p>
          ) : null}
          {listings.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">
              No listings collected. Validate portal sessions on the Connectors page first.
            </p>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="py-2 pr-3">Portal</th>
                    <th className="py-2 pr-3">Title</th>
                    <th className="py-2 pr-3">BHK</th>
                    <th className="py-2 pr-3">Rent</th>
                    <th className="py-2">Link</th>
                  </tr>
                </thead>
                <tbody>
                  {listings.slice(0, 50).map((listing) => (
                    <tr key={listing.id} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                      <td className="py-2 pr-3 text-slate-600">{listing.portal}</td>
                      <td className="py-2 pr-3 font-medium text-slate-900 dark:text-slate-100">
                        {listing.title || 'Listing'}
                      </td>
                      <td className="py-2 pr-3">{listing.bhk ?? '—'}</td>
                      <td className="py-2 pr-3">{formatMoney(listing.rent)}</td>
                      <td className="py-2">
                        {listing.url ? (
                          <a
                            href={listing.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-slate-700 underline hover:text-slate-900 dark:text-slate-300"
                          >
                            Open
                          </a>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
