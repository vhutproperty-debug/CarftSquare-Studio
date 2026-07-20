'use client';

import { useState } from 'react';
import { ChevronDown, ExternalLink } from 'lucide-react';
import type { ResearchScoredListing } from '@/lib/research/types';
import {
  daysOnMarket,
  formatResearchMoney,
} from '@/components/research/ai/research-workspace-utils';

function listedByBadge(listing: ResearchScoredListing): {
  label: string;
  className: string;
} {
  const raw = listing.listedBy || listing.listingSource || 'unknown';
  if (raw === 'owner') {
    return {
      label: 'Owner',
      className: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    };
  }
  if (raw === 'broker') {
    return {
      label: 'Broker',
      className: 'border-amber-200 bg-amber-50 text-amber-900',
    };
  }
  if (raw === 'builder') {
    return {
      label: 'Builder',
      className: 'border-sky-200 bg-sky-50 text-sky-900',
    };
  }
  return {
    label: 'Unknown',
    className: 'border-slate-200 bg-slate-50 text-slate-600',
  };
}

export default function PropertyCard({
  listing,
  selected,
  onToggleSelect,
}: {
  listing: ResearchScoredListing;
  selected?: boolean;
  onToggleSelect?: (id: string, next: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const badge = listedByBadge(listing);
  const price = formatResearchMoney(listing.rent ?? listing.salePrice);
  const portals =
    (listing.portalRefs || []).map((p) => p.portal).filter(Boolean).join(', ') ||
    listing.portal ||
    '—';
  const primaryUrl =
    listing.url ||
    listing.portalRefs?.find((p) => p.url)?.url ||
    undefined;
  const config =
    listing.configuration ||
    (listing.bhk != null ? `${listing.bhk} BHK` : undefined) ||
    '—';
  const area =
    listing.carpetArea != null
      ? `${listing.carpetArea.toLocaleString('en-IN')} sq.ft`
      : '—';
  const building = listing.tower || listing.unit || '—';
  const project = listing.projectName || listing.locality || listing.title || 'Listing';

  return (
    <article
      className={`group overflow-hidden rounded-2xl border bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:bg-slate-900 ${
        selected
          ? 'border-orange-300 ring-1 ring-orange-200 dark:border-orange-700 dark:ring-orange-900'
          : 'border-slate-200/90 dark:border-slate-800'
      }`}
    >
      <div className="flex items-start gap-3 p-4">
        {onToggleSelect ? (
          <input
            type="checkbox"
            checked={Boolean(selected)}
            onChange={(e) => onToggleSelect(listing.id, e.target.checked)}
            className="mt-1"
            aria-label="Select listing"
          />
        ) : null}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <h4 className="truncate text-sm font-semibold text-slate-900 dark:text-slate-50">
                {project}
              </h4>
              <p className="mt-0.5 text-xs text-slate-500">
                Building {building} · {config} · {area}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-50">
                {price}
              </p>
              <p className="text-[11px] text-slate-400">
                Score {listing.relevanceScore ?? '—'}
              </p>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <span
              className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${badge.className}`}
            >
              {badge.label}
            </span>
            <span className="inline-flex rounded-full border border-slate-200 px-2 py-0.5 text-[10px] font-medium text-slate-600 dark:border-slate-700 dark:text-slate-300">
              {portals}
            </span>
            <span className="inline-flex rounded-full border border-slate-200 px-2 py-0.5 text-[10px] font-medium text-slate-600 dark:border-slate-700 dark:text-slate-300">
              DOM {daysOnMarket(listing.postedAt, listing.freshnessHours)}
            </span>
          </div>

          {listing.explanation ? (
            <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
              {listing.explanation}
            </p>
          ) : null}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 px-2.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Details
              <ChevronDown
                className={`h-3.5 w-3.5 transition ${open ? 'rotate-180' : ''}`}
              />
            </button>
            {primaryUrl ? (
              <a
                href={primaryUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 px-2.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                View Original Listing
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            ) : null}
          </div>

          {open ? (
            <dl className="mt-3 grid grid-cols-2 gap-2 rounded-xl border border-slate-100 bg-slate-50/80 p-3 text-[11px] dark:border-slate-800 dark:bg-slate-950/60">
              <div>
                <dt className="text-slate-400">Locality</dt>
                <dd className="font-medium text-slate-800 dark:text-slate-100">
                  {listing.locality || '—'}
                </dd>
              </div>
              <div>
                <dt className="text-slate-400">Furnishing</dt>
                <dd className="font-medium text-slate-800 dark:text-slate-100">
                  {listing.furnishing || '—'}
                </dd>
              </div>
              <div>
                <dt className="text-slate-400">Facing</dt>
                <dd className="font-medium text-slate-800 dark:text-slate-100">
                  {listing.facing || '—'}
                </dd>
              </div>
              <div>
                <dt className="text-slate-400">Parking</dt>
                <dd className="font-medium text-slate-800 dark:text-slate-100">
                  {listing.parking || '—'}
                </dd>
              </div>
              {listing.amenities?.length ? (
                <div className="col-span-2">
                  <dt className="text-slate-400">Amenities</dt>
                  <dd className="font-medium text-slate-800 dark:text-slate-100">
                    {listing.amenities.slice(0, 8).join(', ')}
                  </dd>
                </div>
              ) : null}
            </dl>
          ) : null}
        </div>
      </div>
    </article>
  );
}
