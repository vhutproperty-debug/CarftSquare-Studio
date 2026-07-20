'use client';

import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';
import { ChevronDown, FileSpreadsheet, FileText } from 'lucide-react';
import type { ResearchReport, ResearchScoredListing } from '@/lib/research/types';
import { formatResearchMoney } from '@/components/research/ai/research-workspace-utils';
import PropertyCard from '@/components/research/ai/PropertyCard';
import ResearchMarkdown from '@/components/research/ai/ResearchMarkdown';

type Section = {
  id: string;
  title: string;
  body: ReactNode;
  defaultOpen?: boolean;
};

function Collapsible({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200/90 bg-white dark:border-slate-800 dark:bg-slate-900">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-3.5 py-3 text-left transition hover:bg-slate-50/80 dark:hover:bg-slate-800/50"
      >
        <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-slate-400 transition ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open ? (
        <div className="border-t border-slate-100 px-3.5 py-3 text-sm text-slate-700 dark:border-slate-800 dark:text-slate-200">
          {children}
        </div>
      ) : null}
    </section>
  );
}

function ownerBrokerMix(listings: ResearchScoredListing[]) {
  const counts = { owner: 0, broker: 0, builder: 0, unknown: 0 };
  for (const l of listings) {
    const k = l.listedBy || l.listingSource || 'unknown';
    if (k === 'owner') counts.owner += 1;
    else if (k === 'broker') counts.broker += 1;
    else if (k === 'builder') counts.builder += 1;
    else counts.unknown += 1;
  }
  return counts;
}

export default function ExecutiveReportPanel({
  report,
  listings,
  sessionId,
}: {
  report: ResearchReport;
  listings: ResearchScoredListing[];
  sessionId?: string;
}) {
  const mix = useMemo(() => ownerBrokerMix(listings), [listings]);
  const insights = report.marketInsights;
  const confidencePct = Math.round((report.researchConfidence || 0) * 100);

  const sections: Section[] = [
    {
      id: 'summary',
      title: 'Executive Summary',
      defaultOpen: true,
      body: <ResearchMarkdown text={report.executiveSummary} />,
    },
    {
      id: 'findings',
      title: 'Key Findings',
      defaultOpen: true,
      body: (
        <ul className="list-disc space-y-1.5 pl-5">
          {report.observations.map((o) => (
            <li key={o}>{o}</li>
          ))}
          {!report.observations.length ? (
            <li className="list-none text-slate-400">No findings yet.</li>
          ) : null}
        </ul>
      ),
    },
    {
      id: 'matches',
      title: 'Matching Properties',
      body: (
        <div className="grid gap-3">
          {(report.topMatches?.length ? report.topMatches : listings.slice(0, 6)).map((l) => (
            <PropertyCard key={l.id} listing={l} />
          ))}
        </div>
      ),
    },
    {
      id: 'owner-broker',
      title: 'Owner vs Broker Analysis',
      body: (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {(
            [
              ['Owner', mix.owner],
              ['Broker', mix.broker],
              ['Builder', mix.builder],
              ['Unknown', mix.unknown],
            ] as const
          ).map(([label, n]) => (
            <div
              key={label}
              className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-950"
            >
              <p className="text-[10px] uppercase tracking-wide text-slate-400">{label}</p>
              <p className="text-lg font-semibold tabular-nums text-slate-900 dark:text-slate-50">
                {n}
              </p>
            </div>
          ))}
        </div>
      ),
    },
    {
      id: 'inventory',
      title: 'Inventory Snapshot',
      body: (
        <dl className="grid grid-cols-2 gap-3">
          <div>
            <dt className="text-[10px] uppercase text-slate-400">Listings found</dt>
            <dd className="text-base font-semibold">{report.listingsFound}</dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase text-slate-400">Unique properties</dt>
            <dd className="text-base font-semibold">{insights?.uniquePropertyCount ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase text-slate-400">Duplicates removed</dt>
            <dd className="text-base font-semibold">{report.duplicatesRemoved}</dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase text-slate-400">Duplicate %</dt>
            <dd className="text-base font-semibold">
              {insights ? `${Math.round(insights.duplicatePercentage)}%` : '—'}
            </dd>
          </div>
        </dl>
      ),
    },
    {
      id: 'price',
      title: 'Price Comparison',
      body: (
        <dl className="grid grid-cols-2 gap-3">
          <div>
            <dt className="text-[10px] uppercase text-slate-400">Average ask</dt>
            <dd className="text-base font-semibold">
              {formatResearchMoney(insights?.averageAskingRent)}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase text-slate-400">Median ask</dt>
            <dd className="text-base font-semibold">
              {formatResearchMoney(insights?.medianAskingRent)}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase text-slate-400">Min</dt>
            <dd className="text-base font-semibold">
              {formatResearchMoney(insights?.minAskingRent)}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase text-slate-400">Max</dt>
            <dd className="text-base font-semibold">
              {formatResearchMoney(insights?.maxAskingRent)}
            </dd>
          </div>
        </dl>
      ),
    },
    {
      id: 'trend',
      title: 'Market Trend',
      body: (
        <ul className="list-disc space-y-1.5 pl-5">
          {(insights?.notes || []).map((n) => (
            <li key={n}>{n}</li>
          ))}
          {!(insights?.notes || []).length ? (
            <li className="list-none text-slate-400">
              Trend signals will appear as more inventory is collected.
            </li>
          ) : null}
        </ul>
      ),
    },
    {
      id: 'negotiation',
      title: 'Negotiation Strategy',
      body: (
        <ul className="list-disc space-y-1.5 pl-5">
          {report.recommendedNextSteps.slice(0, 3).map((s) => (
            <li key={s}>{s}</li>
          ))}
          {!report.recommendedNextSteps.length ? (
            <li className="list-none text-slate-400">
              Use price spread and DOM to pressure soft asks; prefer owner listings for direct
              negotiation.
            </li>
          ) : null}
        </ul>
      ),
    },
    {
      id: 'investment',
      title: 'Investment Opportunity',
      body: (
        <p className="leading-relaxed text-slate-700 dark:text-slate-200">
          {insights?.outlierListingIds?.length
            ? `${insights.outlierListingIds.length} outlier listing(s) flagged relative to the ask band — review those first for opportunistic pricing.`
            : 'No strong outlier opportunities flagged in this pass. Re-run with a tighter locality or BHK filter for sharper yield signals.'}
        </p>
      ),
    },
    {
      id: 'confidence',
      title: 'Confidence Score',
      defaultOpen: true,
      body: (
        <div>
          <div className="mb-2 flex items-end justify-between">
            <span className="text-2xl font-semibold tabular-nums text-slate-900 dark:text-slate-50">
              {confidencePct}%
            </span>
            <span className="text-xs text-slate-400">Research confidence</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div
              className="h-full rounded-full bg-orange-500 transition-all duration-700"
              style={{ width: `${Math.min(100, Math.max(0, confidencePct))}%` }}
            />
          </div>
        </div>
      ),
    },
    {
      id: 'action',
      title: 'Recommended Action',
      defaultOpen: true,
      body: (
        <ul className="list-disc space-y-1.5 pl-5">
          {report.recommendedNextSteps.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
      ),
    },
    {
      id: 'sources',
      title: 'Sources',
      body: (
        <div className="flex flex-wrap gap-1.5">
          {(report.portalsSearched || []).map((p) => (
            <span
              key={p}
              className="rounded-full border border-slate-200 px-2.5 py-1 text-[11px] font-medium capitalize text-slate-700 dark:border-slate-700 dark:text-slate-200"
            >
              {p}
            </span>
          ))}
          <p className="mt-2 w-full text-xs text-slate-400">
            Strategy: {report.searchStrategy || 'Multi-portal inventory scan'}
          </p>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Executive Report
          </h3>
          <p className="text-[11px] text-slate-400">
            Generated {new Date(report.generatedAt).toLocaleString('en-IN')}
          </p>
        </div>
        {sessionId ? (
          <div className="flex flex-wrap gap-1.5">
            <a
              href={`/api/research/ai/sessions/${sessionId}/export?format=pdf`}
              className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200"
            >
              <FileText className="h-3.5 w-3.5" />
              PDF
            </a>
            <a
              href={`/api/research/ai/sessions/${sessionId}/export?format=excel`}
              className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              Excel
            </a>
            <a
              href={`/api/research/ai/sessions/${sessionId}/export?format=csv`}
              className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200"
            >
              CSV
            </a>
          </div>
        ) : null}
      </div>

      {report.warnings?.length ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100">
          {report.warnings.join(' ')}
        </div>
      ) : null}

      <div className="space-y-2">
        {sections.map((s) => (
          <Collapsible key={s.id} title={s.title} defaultOpen={s.defaultOpen}>
            {s.body}
          </Collapsible>
        ))}
      </div>
    </div>
  );
}
