'use client';

import DealProbabilityBadge from '@/components/ops/deals/DealProbabilityBadge';
import DealStageBadge from '@/components/ops/deals/DealStageBadge';
import type { DealQueueItem } from '@/lib/ops/deals/types';
import { dealDisplayLabel } from '@/lib/ops/deals/types';
import { DEAL_PAYMENT_STATUS_LABELS } from '@/lib/ops/deals/statuses';

type DealQueueProps = {
  items: DealQueueItem[];
  selectedId: string | null;
  onSelect: (item: DealQueueItem) => void;
};

export default function DealQueue({ items, selectedId, onSelect }: DealQueueProps) {
  if (!items.length) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center text-sm text-slate-500">
        No deals yet. Accept a match in Matching Engine and click Create Deal.
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
            className={`w-full rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm ${
              selectedId === item.id ? 'ring-2 ring-slate-900' : ''
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold text-slate-900">{item.deal.dealNumber}</p>
                <p className="text-sm text-slate-600">{dealDisplayLabel(item.deal)}</p>
              </div>
              <DealProbabilityBadge probability={item.deal.probability} />
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <DealStageBadge stage={item.deal.stage} />
              <span className="text-xs uppercase text-slate-500">{item.deal.transactionType || '—'}</span>
            </div>
          </button>
        ))}
      </div>

      <div className="hidden overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm md:block">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-3">Deal #</th>
                <th className="px-3 py-3">Client</th>
                <th className="px-3 py-3">Project</th>
                <th className="px-3 py-3">Building</th>
                <th className="px-3 py-3">Type</th>
                <th className="px-3 py-3">Stage</th>
                <th className="px-3 py-3">Probability</th>
                <th className="px-3 py-3">Brokerage</th>
                <th className="px-3 py-3">Payment</th>
                <th className="px-3 py-3">Broker</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const selected = selectedId === item.id;
                return (
                  <tr
                    key={item.id}
                    onClick={() => onSelect(item)}
                    className={`cursor-pointer border-b border-slate-100 transition-colors hover:bg-slate-50 ${
                      selected ? 'bg-slate-900 text-white hover:bg-slate-800' : ''
                    }`}
                  >
                    <td className="px-3 py-3 font-bold">{item.deal.dealNumber}</td>
                    <td className="px-3 py-3 font-medium">{item.deal.clientName || '—'}</td>
                    <td className="max-w-[120px] truncate px-3 py-3">{item.deal.project || '—'}</td>
                    <td className="max-w-[120px] truncate px-3 py-3">{item.deal.building || '—'}</td>
                    <td className="px-3 py-3 text-xs uppercase">{item.deal.transactionType || '—'}</td>
                    <td className="px-3 py-3">
                      {!selected ? <DealStageBadge stage={item.deal.stage} /> : (
                        <span className="text-xs">{item.deal.stage.replace(/_/g, ' ')}</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      {!selected ? <DealProbabilityBadge probability={item.deal.probability} /> : (
                        <span className="text-sm font-black text-emerald-300">{item.deal.probability}%</span>
                      )}
                    </td>
                    <td className="px-3 py-3">{item.deal.expectedBrokerage || item.deal.actualBrokerage || '—'}</td>
                    <td className="px-3 py-3 text-xs">
                      {item.deal.paymentStatus ? DEAL_PAYMENT_STATUS_LABELS[item.deal.paymentStatus] : '—'}
                    </td>
                    <td className="px-3 py-3">
                      {item.assigneeInitials ? (
                        <span className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                          selected ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                        }`}>
                          {item.assigneeInitials}
                        </span>
                      ) : '—'}
                    </td>
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
