'use client';

import { AlertTriangle } from 'lucide-react';
import SupplyPriorityBadge from '@/components/ops/supply/SupplyPriorityBadge';
import SupplyStatusBadge from '@/components/ops/supply/SupplyStatusBadge';
import type { SupplyQueueItem } from '@/lib/ops/supply/types';
import { supplyDisplayLabel } from '@/lib/ops/supply/types';
import { SUPPLY_SOURCE_LABELS } from '@/lib/ops/supply/statuses';

function rowTone(item: SupplyQueueItem): string {
  const overdue = item.record.priority === 'HIGH'
    && item.record.nextFollowUpAt
    && new Date(item.record.nextFollowUpAt) < new Date();
  if (overdue) return 'bg-red-50/80 border-l-4 border-l-red-500';
  if (item.agreementExpiringSoon) return 'bg-amber-50/60 border-l-4 border-l-amber-400';
  if (item.record.priority === 'HIGH') return 'bg-orange-50/50 border-l-4 border-l-orange-400';
  if (item.record.readyForMatching) return 'border-l-4 border-l-emerald-400';
  return 'border-l-4 border-l-slate-200';
}

type SupplyQueueTableProps = {
  items: SupplyQueueItem[];
  selectedId: string | null;
  onSelect: (item: SupplyQueueItem) => void;
};

export default function SupplyQueueTable({ items, selectedId, onSelect }: SupplyQueueTableProps) {
  if (!items.length) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center text-sm text-slate-500">
        No inventory matches your filters. Add a listing to get started.
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3 md:hidden">
        {items.map((item) => {
          const selected = selectedId === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelect(item)}
              className={`w-full rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm ${rowTone(item)} ${
                selected ? 'ring-2 ring-slate-900' : ''
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-slate-900">{supplyDisplayLabel(item.record)}</p>
                  <p className="text-xs text-slate-500">{item.record.project || '—'}</p>
                </div>
                <SupplyPriorityBadge priority={item.record.priority} />
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <SupplyStatusBadge status={item.record.status} />
                <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-600">
                  {item.record.listingType || '—'}
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                <span>{SUPPLY_SOURCE_LABELS[item.record.source]}</span>
                {item.assigneeInitials ? (
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-200 text-[10px] font-bold text-slate-700">
                    {item.assigneeInitials}
                  </span>
                ) : null}
              </div>
            </button>
          );
        })}
      </div>

      <div className="hidden overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm md:block">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1200px] text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-3">Priority</th>
                <th className="px-3 py-3">Type</th>
                <th className="px-3 py-3">Project</th>
                <th className="px-3 py-3">Building</th>
                <th className="px-3 py-3">Config</th>
                <th className="px-3 py-3">Flat</th>
                <th className="px-3 py-3">Rent / Price</th>
                <th className="px-3 py-3">Owner</th>
                <th className="px-3 py-3">Source</th>
                <th className="px-3 py-3">Broker</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3">Matching</th>
                <th className="px-3 py-3">Last Activity</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const selected = selectedId === item.id;
                const price = item.record.listingType === 'sale'
                  ? item.record.expectedSalePrice
                  : item.record.expectedRent;
                return (
                  <tr
                    key={item.id}
                    onClick={() => onSelect(item)}
                    className={`cursor-pointer border-b border-slate-100 transition-colors hover:bg-slate-50 ${rowTone(item)} ${
                      selected ? 'bg-slate-900 text-white hover:bg-slate-800' : ''
                    }`}
                  >
                    <td className="px-3 py-3">
                      {!selected ? (
                        <SupplyPriorityBadge priority={item.record.priority} />
                      ) : (
                        <span className="text-xs font-bold text-orange-300">{item.record.priority}</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-xs font-semibold uppercase">{item.record.listingType || '—'}</td>
                    <td className="max-w-[120px] truncate px-3 py-3 font-medium">{item.record.project || '—'}</td>
                    <td className="max-w-[120px] truncate px-3 py-3">{item.record.building || '—'}</td>
                    <td className="px-3 py-3">{item.record.configuration || '—'}</td>
                    <td className="px-3 py-3">{item.record.flatNumber || '—'}</td>
                    <td className="px-3 py-3 font-medium">{price || '—'}</td>
                    <td className="max-w-[100px] truncate px-3 py-3">{item.record.ownerName || '—'}</td>
                    <td className="px-3 py-3 text-xs">{SUPPLY_SOURCE_LABELS[item.record.source]}</td>
                    <td className="px-3 py-3">
                      {item.assigneeInitials ? (
                        <span className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                          selected ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                        }`}>
                          {item.assigneeInitials}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-3 py-3">
                      {!selected ? <SupplyStatusBadge status={item.record.status} /> : (
                        <span className="text-xs">{item.record.status.replace(/_/g, ' ')}</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-1">
                        {item.record.readyForMatching ? (
                          <span className={`text-xs font-bold ${selected ? 'text-emerald-300' : 'text-emerald-700'}`}>Ready</span>
                        ) : '—'}
                        {item.agreementExpiringSoon ? (
                          <AlertTriangle className={`h-3.5 w-3.5 ${selected ? 'text-amber-300' : 'text-amber-600'}`} title="Agreement expiring" />
                        ) : null}
                      </div>
                    </td>
                    <td className="max-w-[140px] truncate px-3 py-3 text-xs">{item.lastActivityLabel || '—'}</td>
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
