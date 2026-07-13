'use client';

import type { DealWorkspaceMetrics } from '@/lib/ops/deals/types';

function formatCurrency(value: number) {
  if (!value) return '₹0';
  return `₹${value.toLocaleString('en-IN')}`;
}

function KpiCard({ label, value, tone }: { label: string; value: string | number; tone?: string }) {
  return (
    <div className={`rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm ${tone || ''}`}>
      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-black text-slate-900">{value}</p>
    </div>
  );
}

export default function DealKpiHeader({ metrics }: { metrics: DealWorkspaceMetrics }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-9">
      <KpiCard label="Active Deals" value={metrics.activeDeals} tone="border-blue-100" />
      <KpiCard label="Site Visits" value={metrics.siteVisits} />
      <KpiCard label="Negotiations" value={metrics.negotiations} tone="border-amber-100" />
      <KpiCard label="Agreement Pending" value={metrics.agreementPending} tone="border-violet-100" />
      <KpiCard label="Commission Pending" value={metrics.commissionPending} />
      <KpiCard label="Closed" value={metrics.closedDeals} tone="border-emerald-100" />
      <KpiCard label="Lost" value={metrics.lostDeals} />
      <KpiCard label="Expected Revenue" value={formatCurrency(metrics.expectedRevenue)} tone="border-green-200" />
      <KpiCard label="Collected Revenue" value={formatCurrency(metrics.collectedRevenue)} tone="border-green-300" />
    </div>
  );
}
