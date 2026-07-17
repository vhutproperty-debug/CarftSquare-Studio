'use client';

import type { DemandWorkspaceMetrics } from '@/lib/ops/demand/types';

const KPI_ITEMS: Array<{
  key: keyof DemandWorkspaceMetrics;
  label: string;
  format?: (value: number | null | undefined) => string;
}> = [
  { key: 'totalEnquiries', label: 'Total' },
  { key: 'newToday', label: 'New today' },
  { key: 'qualified', label: 'Qualified' },
  { key: 'waitingFollowUp', label: 'Follow-up' },
  { key: 'readyForMatching', label: 'Ready' },
  { key: 'lost', label: 'Lost' },
  {
    key: 'averageResponseMinutes',
    label: 'Avg response',
    format: (value) => (value != null ? `${value}m` : '—'),
  },
];

export default function DemandKpiHeader({ metrics }: { metrics: DemandWorkspaceMetrics }) {
  return (
    <div className="space-y-2">
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="grid grid-cols-2 divide-x divide-y divide-slate-100 sm:grid-cols-4 xl:grid-cols-7 xl:divide-y-0">
          {KPI_ITEMS.map((item) => {
            const raw = metrics[item.key];
            const value = item.format
              ? item.format(typeof raw === 'number' ? raw : null)
              : String(raw ?? 0);
            return (
              <div key={item.key} className="px-3 py-2.5">
                <p className="truncate text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  {item.label}
                </p>
                <p className="mt-0.5 text-lg font-bold tabular-nums leading-none text-slate-900">{value}</p>
              </div>
            );
          })}
        </div>
      </div>
      {metrics.overdueHighPriority > 0 ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-800">
          {metrics.overdueHighPriority} high-priority enquiry(s) overdue for follow-up
        </div>
      ) : null}
    </div>
  );
}
