'use client';

import type { RevenueQueueItem } from '@/lib/ops/revenue/types';
import { REVENUE_STATUS_LABELS, REVENUE_STREAM_LABELS, revenueStatusTone } from '@/lib/ops/revenue/statuses';
import { formatOpsCurrency, formatOpsDate } from '@/components/ops/format';

type RevenueQueueProps = {
  items: RevenueQueueItem[];
  selectedId: string | null;
  onSelect: (item: RevenueQueueItem) => void;
};

export default function RevenueQueue({ items, selectedId, onSelect }: RevenueQueueProps) {
  if (!items.length) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center text-sm text-slate-500">
        No revenue records yet. Sync from deals to populate brokerage tracking.
      </div>
    );
  }

  return (
    <>
      <div className="grid gap-3 md:hidden">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelect(item)}
            className={`w-full rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm ${selectedId === item.id ? 'ring-2 ring-slate-900' : ''}`}
          >
            <p className="font-semibold text-slate-900">{item.record.dealNumber}</p>
            <p className="text-sm text-slate-600">{item.record.clientName || '—'} · {item.record.project || '—'}</p>
            <p className="mt-2 text-sm font-bold text-slate-900">{formatOpsCurrency(item.record.pendingAmount)} pending</p>
          </button>
        ))}
      </div>

      <div className="hidden overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm md:block">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px] text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-3">Deal #</th>
                <th className="px-3 py-3">Client</th>
                <th className="px-3 py-3">Stream</th>
                <th className="px-3 py-3">Expected</th>
                <th className="px-3 py-3">Collected</th>
                <th className="px-3 py-3">Pending</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3">Due</th>
                <th className="px-3 py-3">Broker</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const r = item.record;
                const selected = selectedId === item.id;
                return (
                  <tr
                    key={item.id}
                    onClick={() => onSelect(item)}
                    className={`cursor-pointer border-b border-slate-100 transition-colors hover:bg-slate-50 ${selected ? 'bg-slate-900 text-white hover:bg-slate-800' : ''}`}
                  >
                    <td className="px-3 py-3 font-bold">{r.dealNumber}</td>
                    <td className="px-3 py-3">{r.clientName || '—'}</td>
                    <td className="px-3 py-3">{REVENUE_STREAM_LABELS[r.streamType]}</td>
                    <td className="px-3 py-3">{formatOpsCurrency(r.expectedAmount)}</td>
                    <td className="px-3 py-3">{formatOpsCurrency(r.collectedAmount)}</td>
                    <td className="px-3 py-3 font-semibold">{formatOpsCurrency(r.pendingAmount)}</td>
                    <td className="px-3 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${selected ? 'bg-white/20 text-white' : revenueStatusTone(r.status)}`}>
                        {REVENUE_STATUS_LABELS[r.status]}
                      </span>
                    </td>
                    <td className="px-3 py-3">{formatOpsDate(r.dueDate)}</td>
                    <td className="px-3 py-3">{r.brokerName || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
