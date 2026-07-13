'use client';

import type { DemandWorkspaceMetrics } from '@/lib/ops/demand/types';

function KpiCard({ label, value, tone }: { label: string; value: string | number; tone?: string }) {
  return (
    <div className={`rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm ${tone || ''}`}>
      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-black text-slate-900">{value}</p>
    </div>
  );
}

export default function DemandKpiHeader({ metrics }: { metrics: DemandWorkspaceMetrics }) {
  const avgResponse = metrics.averageResponseMinutes != null
    ? `${metrics.averageResponseMinutes}m`
    : '—';

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-7">
      <KpiCard label="Total Enquiries" value={metrics.totalEnquiries} />
      <KpiCard label="New Today" value={metrics.newToday} tone="border-blue-100" />
      <KpiCard label="Qualified" value={metrics.qualified} tone="border-emerald-100" />
      <KpiCard label="Waiting Follow-up" value={metrics.waitingFollowUp} tone="border-violet-100" />
      <KpiCard label="Ready for Matching" value={metrics.readyForMatching} tone="border-green-200" />
      <KpiCard label="Lost" value={metrics.lost} />
      <KpiCard label="Avg Response" value={avgResponse} />
      {metrics.overdueHighPriority > 0 ? (
        <div className="sm:col-span-2 xl:col-span-7 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-800">
          {metrics.overdueHighPriority} high-priority enquiry(s) overdue for follow-up
        </div>
      ) : null}
    </div>
  );
}
