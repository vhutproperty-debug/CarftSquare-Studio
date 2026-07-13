'use client';

import type { MatchingWorkspaceMetrics } from '@/lib/ops/matching/types';

function KpiCard({ label, value, tone }: { label: string; value: string | number; tone?: string }) {
  return (
    <div className={`rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm ${tone || ''}`}>
      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-black text-slate-900">{value}</p>
    </div>
  );
}

export default function MatchKpiHeader({ metrics }: { metrics: MatchingWorkspaceMetrics }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-8">
      <KpiCard label="Eligible Demand" value={metrics.eligibleDemand} tone="border-blue-100" />
      <KpiCard label="Eligible Supply" value={metrics.eligibleSupply} tone="border-violet-100" />
      <KpiCard label="Suggested" value={metrics.suggestedMatches} />
      <KpiCard label="Shortlisted" value={metrics.shortlisted} tone="border-amber-100" />
      <KpiCard label="Site Visits" value={metrics.siteVisits} tone="border-cyan-100" />
      <KpiCard label="Accepted" value={metrics.accepted} tone="border-emerald-100" />
      <KpiCard label="Rejected" value={metrics.rejected} />
      <KpiCard label="Converted" value={metrics.converted} tone="border-green-200" />
    </div>
  );
}
