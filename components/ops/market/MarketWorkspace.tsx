'use client';

import { useEffect, useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import GapGrid from '@/components/ops/market/GapGrid';
import MarketBoard from '@/components/ops/market/MarketBoard';
import type { MarketFlat, MarketOverview, MarketRequirement } from '@/lib/ops/market/types';

type SideFilter = 'all' | 'rent' | 'sale';
type BoardMode = 'flats' | 'requirements';

function haystackFlat(flat: MarketFlat): string {
  return [flat.headline, flat.project, flat.locality, flat.building, flat.bhkLabel, flat.furnishingLabel, flat.internalRef]
    .join(' ')
    .toLowerCase();
}

function haystackRequirement(requirement: MarketRequirement): string {
  return [requirement.headline, requirement.contactName, requirement.project, requirement.locality, requirement.building, requirement.bhkLabel, requirement.budgetLabel]
    .join(' ')
    .toLowerCase();
}

export default function MarketWorkspace() {
  const [data, setData] = useState<MarketOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<'board' | 'gap'>('board');
  const [mode, setMode] = useState<BoardMode>('flats');
  const [side, setSide] = useState<SideFilter>('all');
  const [search, setSearch] = useState('');
  const [unmatchedOnly, setUnmatchedOnly] = useState(false);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/ops/market', { credentials: 'include' });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(body.error || 'Unable to load the matching board.');
        return;
      }
      setData(body);
    } catch {
      setError('Unable to load the matching board.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const view = useMemo(() => {
    if (!data) return null;
    const query = search.trim().toLowerCase();
    const noDemand = new Set(data.flatsWithoutDemand);
    const noSupply = new Set(data.requirementsWithoutSupply);
    const flats = data.flats.filter((flat) => {
      if (side !== 'all' && flat.transaction !== side) return false;
      if (unmatchedOnly && mode === 'flats' && !noDemand.has(flat.id)) return false;
      if (query && !haystackFlat(flat).includes(query)) return false;
      return true;
    });
    const requirements = data.requirements.filter((requirement) => {
      if (side !== 'all' && requirement.transaction !== side) return false;
      if (unmatchedOnly && mode === 'requirements' && !noSupply.has(requirement.id)) return false;
      if (query && !haystackRequirement(requirement).includes(query)) return false;
      return true;
    });
    flats.sort((a, b) => Number(noDemand.has(b.id)) - Number(noDemand.has(a.id)));
    requirements.sort((a, b) => Number(noSupply.has(b.id)) - Number(noSupply.has(a.id)));
    const flatIds = new Set(flats.map((flat) => flat.id));
    const requirementIds = new Set(requirements.map((requirement) => requirement.id));
    const matches = data.matches.filter((match) => flatIds.has(match.flatId) && requirementIds.has(match.requirementId));
    const gap = data.gap.filter((row) => {
      if (!query) return true;
      return `${row.project} ${row.bhk}`.toLowerCase().includes(query);
    });
    return { flats, requirements, matches, gap };
  }, [data, mode, search, side, unmatchedOnly]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex rounded-lg bg-slate-200/70 p-1">
          <button
            type="button"
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${tab === 'board' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'}`}
            onClick={() => setTab('board')}
            aria-pressed={tab === 'board'}
          >
            Matching board
          </button>
          <button
            type="button"
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${tab === 'gap' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'}`}
            onClick={() => setTab('gap')}
            aria-pressed={tab === 'gap'}
          >
            Supply–demand gap
          </button>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {data ? (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Available flats" value={data.summary.availableFlats} />
          <Stat label="Active requirements" value={data.summary.activeRequirements} />
          <Stat label="Flats with no demand" value={data.summary.flatsWithoutDemand} tone="amber" />
          <Stat label="Requirements with no supply" value={data.summary.requirementsWithoutSupply} tone="amber" />
        </div>
      ) : null}

      <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          aria-label="Search project, locality, or BHK"
          placeholder="Search project, locality, or BHK"
          className="lg:max-w-sm"
        />
        <div className="flex flex-wrap gap-2">
          {(['all', 'rent', 'sale'] as SideFilter[]).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setSide(value)}
              className={`rounded-full px-3 py-1 text-xs font-semibold uppercase ${side === value ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200'}`}
            >
              {value === 'all' ? 'Rent and resale' : value === 'rent' ? 'Rent' : 'Resale'}
            </button>
          ))}
          {tab === 'board' ? (
            <>
              <button
                type="button"
                onClick={() => setMode(mode === 'flats' ? 'requirements' : 'flats')}
                className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200"
              >
                {mode === 'flats' ? 'Viewing flats' : 'Viewing requirements'}
              </button>
              <label className="flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
                <input
                  type="checkbox"
                  checked={unmatchedOnly}
                  onChange={(event) => setUnmatchedOnly(event.target.checked)}
                />
                Unmatched only
              </label>
            </>
          ) : null}
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div>
      ) : null}

      {loading && !data ? (
        <div className="rounded-xl border border-slate-200 bg-white px-6 py-12 text-center text-sm text-slate-500">
          Loading supply and demand…
        </div>
      ) : null}

      {data && view && tab === 'board' ? (
        <MarketBoard
          mode={mode}
          flats={view.flats}
          requirements={view.requirements}
          matches={view.matches}
          allMatches={data.matches}
          flatsWithoutDemand={data.flatsWithoutDemand}
          requirementsWithoutSupply={data.requirementsWithoutSupply}
        />
      ) : null}

      {data && view && tab === 'gap' ? (
        <div className="space-y-3">
          <p className="text-sm text-slate-600">
            {data.summary.pushAdsCells} cells have surplus flats (push ads). {data.summary.brokerOutreachCells} cells are short of flats (broker outreach).
            Search narrows the grid. Counts still come from available inventory and active requirements.
          </p>
          <GapGrid rows={view.gap} />
        </div>
      ) : null}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: 'amber' }) {
  return (
    <div className={`rounded-xl border px-4 py-3 ${tone === 'amber' ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-white'}`}>
      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{value}</p>
    </div>
  );
}
