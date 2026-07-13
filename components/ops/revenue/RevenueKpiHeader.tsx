'use client';

import type { RevenueWorkspaceMetrics } from '@/lib/ops/revenue/types';
import { formatOpsCurrency } from '@/components/ops/format';

function KpiCard({ label, value, tone }: { label: string; value: string | number; tone?: string }) {
  return (
    <div className={`rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm ${tone || ''}`}>
      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-black text-slate-900">{value}</p>
    </div>
  );
}

export default function RevenueKpiHeader({ metrics }: { metrics: RevenueWorkspaceMetrics }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7">
      <KpiCard label="Expected Revenue" value={formatOpsCurrency(metrics.expectedRevenue)} tone="border-green-200" />
      <KpiCard label="Pending Brokerage" value={formatOpsCurrency(metrics.pendingBrokerage)} tone="border-amber-100" />
      <KpiCard label="Collected" value={formatOpsCurrency(metrics.collectedRevenue)} tone="border-emerald-100" />
      <KpiCard label="Invoiced / Partial" value={metrics.invoicedPending} />
      <KpiCard label="Overdue" value={metrics.overdueCount} tone="border-red-100" />
      <KpiCard label="Interior Referrals" value={metrics.interiorReferrals} />
      <KpiCard label="Brokers" value={metrics.brokerCount} />
    </div>
  );
}
