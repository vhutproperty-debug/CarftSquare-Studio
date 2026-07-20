'use client';

import { useState } from 'react';
import { ExternalLink, Search } from 'lucide-react';
import { DEFAULT_RESEARCH_WORKSPACE } from '@/lib/research/business';
import type { KgProperty } from '@/lib/research/graph/types';

type ListedByFilter = 'any' | 'owner' | 'broker' | 'builder' | 'unknown';

function formatPrice(p: KgProperty): string {
  if (p.rent != null && Number.isFinite(p.rent)) {
    return `₹${p.rent.toLocaleString('en-IN')}/mo`;
  }
  if (p.salePrice != null && Number.isFinite(p.salePrice)) {
    return `₹${p.salePrice.toLocaleString('en-IN')}`;
  }
  return '—';
}

function listedByLabel(value?: string): string {
  if (!value) return 'Unknown';
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export default function InventorySearchPanel() {
  const [locality, setLocality] = useState('');
  const [bhk, setBhk] = useState('');
  const [listedBy, setListedBy] = useState<ListedByFilter>('any');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<KgProperty[]>([]);
  const [searched, setSearched] = useState(false);

  const search = async () => {
    const localityName = locality.trim();
    if (!localityName) {
      setError('Enter a locality to search.');
      return;
    }
    setLoading(true);
    setError(null);
    setSearched(true);
    try {
      const filters: Record<string, unknown> = {
        localityName,
        limit: 100,
        status: 'active',
      };
      const bhkNum = Number(bhk);
      if (bhk.trim() && Number.isFinite(bhkNum) && bhkNum > 0) {
        filters.bhk = bhkNum;
      }
      if (listedBy !== 'any') {
        filters.listedBy = listedBy;
      }

      const res = await fetch('/api/research/graph/search', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId: DEFAULT_RESEARCH_WORKSPACE.id,
          filters,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Search failed');
      setResults(Array.isArray(json.properties) ? json.properties : []);
    } catch (err) {
      setResults([]);
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          Locality inventory
        </p>
        <p className="mt-1 text-xs text-slate-500">
          Searches the knowledge graph (collected portal listings). Does not launch a live browser.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">
            Locality
            <input
              type="text"
              value={locality}
              onChange={(e) => setLocality(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void search();
              }}
              placeholder="e.g. Andheri West"
              className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-orange-500 focus:ring-2 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </label>

          <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">
            BHK (optional)
            <input
              type="number"
              min={1}
              step={0.5}
              value={bhk}
              onChange={(e) => setBhk(e.target.value)}
              placeholder="Any"
              className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-orange-500 focus:ring-2 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </label>

          <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">
            Listed by
            <select
              value={listedBy}
              onChange={(e) => setListedBy(e.target.value as ListedByFilter)}
              className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-orange-500 focus:ring-2 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            >
              <option value="any">Any</option>
              <option value="owner">Owner</option>
              <option value="broker">Broker</option>
              <option value="builder">Builder</option>
              <option value="unknown">Unknown</option>
            </select>
          </label>

          <div className="flex items-end">
            <button
              type="button"
              onClick={() => void search()}
              disabled={loading}
              className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-orange-600 px-3 py-2 text-sm font-medium text-white hover:bg-orange-500 disabled:opacity-60"
            >
              <Search className="h-4 w-4" />
              {loading ? 'Searching…' : 'Search'}
            </button>
          </div>
        </div>

        {error ? (
          <p className="mt-3 text-sm text-rose-600 dark:text-rose-400">{error}</p>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-800">
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Results</p>
          <p className="text-xs text-slate-500">
            {searched ? `${results.length} propert${results.length === 1 ? 'y' : 'ies'}` : '—'}
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-950/60">
              <tr>
                <th className="px-3 py-2 font-medium">Locality</th>
                <th className="px-3 py-2 font-medium">Project / building</th>
                <th className="px-3 py-2 font-medium">BHK</th>
                <th className="px-3 py-2 font-medium">Carpet</th>
                <th className="px-3 py-2 font-medium">Price</th>
                <th className="px-3 py-2 font-medium">Listed by</th>
                <th className="px-3 py-2 font-medium">Portal</th>
                <th className="px-3 py-2 font-medium">Days on market</th>
                <th className="px-3 py-2 font-medium">Listing</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {!searched ? (
                <tr>
                  <td colSpan={9} className="px-3 py-8 text-center text-slate-500">
                    Enter a locality and search to see inventory.
                  </td>
                </tr>
              ) : results.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-3 py-8 text-center text-slate-500">
                    No matching properties in the knowledge graph.
                  </td>
                </tr>
              ) : (
                results.map((p) => {
                  const portal = p.portalKeys?.[0] || '—';
                  const url = p.portalUrls?.[0];
                  return (
                    <tr key={p.id} className="text-slate-800 dark:text-slate-200">
                      <td className="px-3 py-2">{p.localityName || locality || '—'}</td>
                      <td className="px-3 py-2">
                        <div className="font-medium">{p.projectName || p.buildingName || '—'}</div>
                        {p.title ? (
                          <div className="max-w-[220px] truncate text-xs text-slate-500">
                            {p.title}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-3 py-2">{p.bhk ?? p.configuration ?? '—'}</td>
                      <td className="px-3 py-2">
                        {p.carpetArea != null ? `${p.carpetArea} sqft` : '—'}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">{formatPrice(p)}</td>
                      <td className="px-3 py-2">{listedByLabel(p.listedBy)}</td>
                      <td className="px-3 py-2 capitalize">{portal}</td>
                      <td className="px-3 py-2">{p.daysOnMarket ?? '—'}</td>
                      <td className="px-3 py-2">
                        {url ? (
                          <a
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-orange-600 hover:underline dark:text-orange-400"
                          >
                            Open
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
