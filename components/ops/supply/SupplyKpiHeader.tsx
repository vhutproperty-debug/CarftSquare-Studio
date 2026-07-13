'use client';

import type { SupplyWorkspaceMetrics } from '@/lib/ops/supply/types';

function KpiCard({ label, value, tone }: { label: string; value: string | number; tone?: string }) {
  return (
    <div className={`rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm ${tone || ''}`}>
      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-black text-slate-900">{value}</p>
    </div>
  );
}

export default function SupplyKpiHeader({ metrics }: { metrics: SupplyWorkspaceMetrics }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-8">
      <KpiCard label="Total Inventory" value={metrics.totalInventory} />
      <KpiCard label="Rental" value={metrics.rentalInventory} tone="border-blue-100" />
      <KpiCard label="Sale" value={metrics.saleInventory} tone="border-violet-100" />
      <KpiCard label="Available Now" value={metrics.availableNow} tone="border-emerald-100" />
      <KpiCard label="Ready for Matching" value={metrics.readyForMatching} tone="border-green-200" />
      <KpiCard label="Agreement Expiring" value={metrics.agreementExpiring} tone="border-amber-100" />
      <KpiCard label="Exclusive" value={metrics.exclusiveListings} />
      <KpiCard label="Withdrawn" value={metrics.withdrawn} />
    </div>
  );
}
