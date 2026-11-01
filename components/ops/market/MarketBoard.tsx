import type { ReactNode } from 'react';
import Link from 'next/link';
import BrokerShareActions from '@/components/ops/market/BrokerShareActions';
import type { MarketFlat, MarketMatch, MarketRequirement } from '@/lib/ops/market/types';

type MarketBoardProps = {
  mode: 'flats' | 'requirements';
  flats: MarketFlat[];
  requirements: MarketRequirement[];
  matches: MarketMatch[];
  allMatches: MarketMatch[];
  flatsWithoutDemand: string[];
  requirementsWithoutSupply: string[];
};

function MatchList({
  title,
  empty,
  count,
  children,
}: {
  title: string;
  empty: string;
  count: number;
  children: ReactNode;
}) {
  return (
    <div className="mt-3">
      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{title}</p>
      <div className="mt-2 space-y-2">
        {count === 0 ? <p className="text-sm text-amber-800">{empty}</p> : children}
      </div>
    </div>
  );
}

export default function MarketBoard({
  mode,
  flats,
  requirements,
  matches,
  allMatches,
  flatsWithoutDemand,
  requirementsWithoutSupply,
}: MarketBoardProps) {
  const flatById = new Map(flats.map((flat) => [flat.id, flat]));
  const requirementById = new Map(requirements.map((requirement) => [requirement.id, requirement]));
  const noDemand = new Set(flatsWithoutDemand);
  const noSupply = new Set(requirementsWithoutSupply);

  if (mode === 'flats') {
    if (!flats.length) {
      return (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center text-sm text-slate-500">
          No available flats match this view.
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {flats.map((flat) => {
          const paired = matches
            .filter((match) => match.flatId === flat.id)
            .map((match) => ({ match, requirement: requirementById.get(match.requirementId) }))
            .filter((item) => item.requirement);
          const unmatched = noDemand.has(flat.id);
          const totalMatches = allMatches.filter((match) => match.flatId === flat.id).length;
          return (
            <article
              key={flat.id}
              className={`rounded-xl border bg-white p-4 shadow-sm ${unmatched ? 'border-amber-300 bg-amber-50/40' : 'border-slate-200'}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-semibold text-slate-900">{flat.headline}</h3>
                    {unmatched ? (
                      <span className="rounded-full bg-amber-200 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-950">
                        No demand
                      </span>
                    ) : (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-900">
                        {totalMatches} requirement{totalMatches === 1 ? '' : 's'}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-slate-600">
                    {[flat.transaction === 'sale' ? 'Resale' : flat.transaction === 'rent' ? 'Rent' : 'Type open', flat.bhkLabel, flat.furnishingLabel, flat.amountLabel, flat.project || flat.locality || 'Location open']
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                  {flat.internalRef ? (
                    <p className="mt-1 text-xs text-slate-500">Internal only: {flat.internalRef}</p>
                  ) : null}
                </div>
                <BrokerShareActions card={flat.share} compact />
              </div>
              <MatchList
                title="Matching requirements"
                count={paired.length}
                empty={unmatched
                  ? 'No requirement matches this flat on BHK, budget, rent/sale, location, and furnishing.'
                  : 'No matching requirement in the current filter.'}
              >
                {paired.map(({ match, requirement }) => requirement ? (
                  <Link
                    key={match.requirementId}
                    href={requirement.href}
                    className="block rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm hover:border-slate-400"
                  >
                    <span className="font-medium text-slate-900">{requirement.headline}</span>
                    <span className="mt-1 block text-xs text-slate-500">{match.reasons.join(' · ')} · {requirement.budgetLabel}</span>
                  </Link>
                ) : null)}
              </MatchList>
            </article>
          );
        })}
      </div>
    );
  }

  if (!requirements.length) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center text-sm text-slate-500">
        No active requirements match this view.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {requirements.map((requirement) => {
        const paired = matches
          .filter((match) => match.requirementId === requirement.id)
          .map((match) => ({ match, flat: flatById.get(match.flatId) }))
          .filter((item) => item.flat);
        const unmatched = noSupply.has(requirement.id);
        const totalMatches = allMatches.filter((match) => match.requirementId === requirement.id).length;
        return (
          <article
            key={requirement.id}
            className={`rounded-xl border bg-white p-4 shadow-sm ${unmatched ? 'border-amber-300 bg-amber-50/40' : 'border-slate-200'}`}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base font-semibold text-slate-900">{requirement.headline}</h3>
                  {unmatched ? (
                    <span className="rounded-full bg-amber-200 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-950">
                      No supply
                    </span>
                  ) : (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-900">
                      {totalMatches} flat{totalMatches === 1 ? '' : 's'}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm text-slate-600">
                  {[requirement.transaction === 'sale' ? 'Resale' : requirement.transaction === 'rent' ? 'Rent' : 'Type open', requirement.bhkLabel, requirement.furnishingLabel, requirement.budgetLabel, requirement.project || requirement.locality || 'Any location']
                    .filter(Boolean)
                    .join(' · ')}
                </p>
                <Link href={requirement.href} className="mt-1 inline-block text-xs font-medium text-slate-700 underline">
                  Open requirement
                </Link>
              </div>
            </div>
            <MatchList
              title="Matching flats"
              count={paired.length}
              empty={unmatched
                ? 'No available flat matches this requirement.'
                : 'No matching flat in the current filter.'}
            >
              {paired.map(({ match, flat }) => flat ? (
                <div key={match.flatId} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
                  <div>
                    <p className="text-sm font-medium text-slate-900">{flat.headline}</p>
                    <p className="text-xs text-slate-500">{match.reasons.join(' · ')} · {flat.amountLabel}</p>
                  </div>
                  <BrokerShareActions card={flat.share} compact />
                </div>
              ) : null)}
            </MatchList>
          </article>
        );
      })}
    </div>
  );
}
