'use client';

import type { BrokerWorkspaceMetrics } from '@/lib/ops/brokers/types';

function KpiCard({ label, value, tone }: { label: string; value: string | number; tone?: string }) {
  return (
    <div className={`rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm ${tone || ''}`}>
      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-black text-slate-900">{value}</p>
    </div>
  );
}

function formatDate(value: string | null): string {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
}

export default function BrokersKpiHeader({ metrics }: { metrics: BrokerWorkspaceMetrics }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
      <KpiCard label="Active inventory" value={metrics.totalActive} />
      <KpiCard label="Fresh" value={metrics.fresh} tone="border-emerald-100" />
      <KpiCard label="Aging" value={metrics.aging} tone="border-amber-100" />
      <KpiCard label="Stale" value={metrics.stale} tone="border-rose-100" />
      <KpiCard label="Pending review" value={metrics.pendingReviews ?? 0} tone="border-orange-100" />
      <KpiCard label="Rental" value={metrics.rental} tone="border-blue-100" />
      <KpiCard label="Sale" value={metrics.sale} tone="border-violet-100" />
      <KpiCard label="Projects" value={metrics.uniqueProjects} />
      <KpiCard label="Brokers" value={metrics.uniqueBrokers} />
      <KpiCard label="Last import" value={formatDate(metrics.lastImportAt)} />
    </div>
  );
}
