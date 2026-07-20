'use client';

import type { ReactNode } from 'react';
import { Check, Loader2, MapPin } from 'lucide-react';
import type {
  ResearchAiProgress,
  ResearchReport,
  ResearchScoredListing,
} from '@/lib/research/types';
import type { LiveStep } from '@/components/research/ai/research-workspace-utils';
import { formatResearchMoney } from '@/components/research/ai/research-workspace-utils';
import PropertyCard from '@/components/research/ai/PropertyCard';
import ResearchMarkdown from '@/components/research/ai/ResearchMarkdown';

/**
 * Live AI research canvas — right pane that updates while research runs.
 */
export default function ResearchCanvas({
  busy,
  progress,
  liveSteps,
  listings,
  report,
}: {
  busy: boolean;
  progress?: ResearchAiProgress | null;
  liveSteps: LiveStep[];
  listings: ResearchScoredListing[];
  report?: ResearchReport | null;
}) {
  const mix = { owner: 0, broker: 0, builder: 0, unknown: 0 };
  for (const l of listings) {
    const k = l.listedBy || l.listingSource || 'unknown';
    if (k === 'owner') mix.owner += 1;
    else if (k === 'broker') mix.broker += 1;
    else if (k === 'builder') mix.builder += 1;
    else mix.unknown += 1;
  }

  const insights = report?.marketInsights;
  const showSkeleton = busy && !listings.length && !report;

  return (
    <aside className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-gradient-to-b from-white via-white to-slate-50 shadow-sm dark:border-slate-800 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-800">
        <div>
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Research Canvas
          </p>
          <p className="text-[11px] text-slate-500">
            {busy
              ? progress?.message || 'Analyst preparing the brief…'
              : report
                ? 'Live briefing ready'
                : 'Updates appear as research progresses'}
          </p>
        </div>
        {busy ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2 py-0.5 text-[10px] font-semibold text-orange-700 dark:bg-orange-950/50 dark:text-orange-300">
            <Loader2 className="h-3 w-3 animate-spin" />
            Live
          </span>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        {showSkeleton ? (
          <div className="space-y-3 animate-pulse">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-20 rounded-xl bg-slate-100 dark:bg-slate-800" />
            ))}
          </div>
        ) : null}

        {liveSteps.length > 0 ? (
          <CanvasBlock title="Progress">
            <ul className="space-y-1.5">
              {liveSteps
                .filter((s) => s.status !== 'pending')
                .slice(-6)
                .map((step) => (
                  <li key={step.id} className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                    {step.status === 'done' ? (
                      <Check className="h-3.5 w-3.5 text-emerald-600" />
                    ) : (
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-orange-600" />
                    )}
                    {step.label}
                  </li>
                ))}
            </ul>
          </CanvasBlock>
        ) : null}

        <CanvasBlock title="Executive Summary">
          {report?.executiveSummary ? (
            <ResearchMarkdown text={report.executiveSummary} className="text-[13px]" />
          ) : (
            <p className="text-xs text-slate-400">
              Summary will stream in once portals respond.
            </p>
          )}
        </CanvasBlock>

        <CanvasBlock title="Market Intelligence">
          {insights ? (
            <dl className="grid grid-cols-2 gap-2 text-xs">
              <Stat label="Listings" value={String(insights.listingCount)} />
              <Stat label="Unique" value={String(insights.uniquePropertyCount)} />
              <Stat label="Avg ask" value={formatResearchMoney(insights.averageAskingRent)} />
              <Stat label="Median" value={formatResearchMoney(insights.medianAskingRent)} />
            </dl>
          ) : (
            <p className="text-xs text-slate-400">Collecting market signals…</p>
          )}
        </CanvasBlock>

        <CanvasBlock title="Matching Inventory">
          {listings.length ? (
            <div className="space-y-2">
              {listings.slice(0, 4).map((l) => (
                <PropertyCard key={l.id} listing={l} />
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-400">Matching inventory appears here.</p>
          )}
        </CanvasBlock>

        <CanvasBlock title="Comparable Listings">
          {listings.length > 4 ? (
            <div className="space-y-2">
              {listings.slice(4, 8).map((l) => (
                <PropertyCard key={l.id} listing={l} />
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-400">Comparables unlock after more matches arrive.</p>
          )}
        </CanvasBlock>

        <CanvasBlock title="Map">
          <div className="flex h-28 flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 text-slate-400 dark:border-slate-700 dark:bg-slate-950">
            <MapPin className="mb-1 h-5 w-5" />
            <p className="text-xs">Map preview unavailable</p>
          </div>
        </CanvasBlock>

        <CanvasBlock title="Price Trend">
          {insights?.minAskingRent != null && insights?.maxAskingRent != null ? (
            <div className="space-y-2 text-xs">
              <div className="flex justify-between text-slate-500">
                <span>{formatResearchMoney(insights.minAskingRent)}</span>
                <span>{formatResearchMoney(insights.maxAskingRent)}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                <div className="h-full w-2/3 rounded-full bg-gradient-to-r from-orange-400 to-amber-500" />
              </div>
              <p className="text-slate-500">Ask band across current matches</p>
            </div>
          ) : (
            <p className="text-xs text-slate-400">Price band forms as listings land.</p>
          )}
        </CanvasBlock>

        <CanvasBlock title="Owner / Broker Mix">
          <div className="grid grid-cols-4 gap-1.5 text-center text-[11px]">
            {(
              [
                ['Owner', mix.owner],
                ['Broker', mix.broker],
                ['Builder', mix.builder],
                ['?', mix.unknown],
              ] as const
            ).map(([label, n]) => (
              <div
                key={label}
                className="rounded-lg border border-slate-100 bg-slate-50 px-1 py-2 dark:border-slate-800 dark:bg-slate-950"
              >
                <p className="font-semibold tabular-nums text-slate-900 dark:text-slate-50">{n}</p>
                <p className="text-slate-400">{label}</p>
              </div>
            ))}
          </div>
        </CanvasBlock>

        <CanvasBlock title="Recommendations">
          {report?.recommendedNextSteps?.length ? (
            <ul className="list-disc space-y-1 pl-4 text-xs text-slate-700 dark:text-slate-200">
              {report.recommendedNextSteps.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-slate-400">Actions appear with the executive brief.</p>
          )}
        </CanvasBlock>
      </div>
    </aside>
  );
}

function CanvasBlock({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-100 bg-white/80 p-3 dark:border-slate-800 dark:bg-slate-950/40">
      <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
        {title}
      </h3>
      {children}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50 px-2 py-1.5 dark:border-slate-800 dark:bg-slate-950">
      <p className="text-[10px] uppercase text-slate-400">{label}</p>
      <p className="font-semibold tabular-nums text-slate-900 dark:text-slate-50">{value}</p>
    </div>
  );
}
