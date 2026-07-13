'use client';

import type { AgreementWorkspaceMetrics } from '@/lib/ops/agreements/types';

function KpiCard({ label, value, tone }: { label: string; value: string | number; tone?: string }) {
  return (
    <div className={`rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm ${tone || ''}`}>
      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-black text-slate-900">{value}</p>
    </div>
  );
}

export default function AgreementKpiHeader({ metrics }: { metrics: AgreementWorkspaceMetrics }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7">
      <KpiCard label="Total" value={metrics.totalAgreements} />
      <KpiCard label="Draft" value={metrics.draft} />
      <KpiCard label="Scheduled" value={metrics.scheduled} tone="border-blue-100" />
      <KpiCard label="Signed" value={metrics.signed} tone="border-emerald-100" />
      <KpiCard label="Expiring Soon" value={metrics.expiringSoon} tone="border-amber-100" />
      <KpiCard label="Expired" value={metrics.expired} tone="border-red-100" />
      <KpiCard label="Docs Pending" value={metrics.pendingDocuments} />
    </div>
  );
}
