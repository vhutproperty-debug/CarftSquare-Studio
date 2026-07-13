'use client';

import type { OpsRenewalRecord } from '@/lib/ops/renewals/types';
import { RENEWAL_STATUS_LABELS, renewalStatusTone } from '@/lib/ops/renewals/statuses';
import { formatOpsDate } from '@/components/ops/format';

type RenewalQueueProps = {
  items: Array<{ id: string; record: OpsRenewalRecord }>;
  selectedId: string | null;
  onSelect: (id: string) => void;
};

export default function RenewalQueue({ items, selectedId, onSelect }: RenewalQueueProps) {
  if (!items.length) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center text-sm text-slate-500">
        No renewals yet. Generate from signed agreements with expiry or renewal dates.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[800px] text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-3">Deal #</th>
              <th className="px-3 py-3">Client</th>
              <th className="px-3 py-3">Project</th>
              <th className="px-3 py-3">Due date</th>
              <th className="px-3 py-3">Status</th>
              <th className="px-3 py-3">Broker</th>
            </tr>
          </thead>
          <tbody>
            {items.map(({ id, record: r }) => {
              const selected = selectedId === id;
              return (
                <tr key={id} onClick={() => onSelect(id)} className={`cursor-pointer border-b border-slate-100 hover:bg-slate-50 ${selected ? 'bg-slate-900 text-white hover:bg-slate-800' : ''}`}>
                  <td className="px-3 py-3 font-bold">{r.dealNumber}</td>
                  <td className="px-3 py-3">{r.clientName || '—'}</td>
                  <td className="px-3 py-3">{r.project || '—'}</td>
                  <td className="px-3 py-3">{formatOpsDate(r.dueDate)}</td>
                  <td className="px-3 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${selected ? 'bg-white/20 text-white' : renewalStatusTone(r.status)}`}>
                      {RENEWAL_STATUS_LABELS[r.status]}
                    </span>
                  </td>
                  <td className="px-3 py-3">{r.brokerName || '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
