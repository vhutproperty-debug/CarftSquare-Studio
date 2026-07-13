'use client';

import type { RenewalWorkspaceMetrics } from '@/lib/ops/renewals/types';

function KpiCard({ label, value, tone }: { label: string; value: string | number; tone?: string }) {
  return (
    <div className={`rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm ${tone || ''}`}>
      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-black text-slate-900">{value}</p>
    </div>
  );
}

export default function RenewalKpiHeader({ metrics }: { metrics: RenewalWorkspaceMetrics }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <KpiCard label="Upcoming" value={metrics.upcoming} tone="border-amber-100" />
      <KpiCard label="Due Now" value={metrics.dueNow} tone="border-red-100" />
      <KpiCard label="Renewed" value={metrics.renewed} tone="border-emerald-100" />
      <KpiCard label="Lapsed" value={metrics.lapsed} />
    </div>
  );
}
