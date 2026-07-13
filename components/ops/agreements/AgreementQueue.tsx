'use client';

import type { OpsAgreementRecord } from '@/lib/ops/agreements/types';
import { AGREEMENT_STATUS_LABELS, AGREEMENT_TYPE_LABELS, agreementStatusTone } from '@/lib/ops/agreements/statuses';
import { formatOpsDate } from '@/components/ops/format';

type AgreementQueueProps = {
  items: Array<{ id: string; record: OpsAgreementRecord }>;
  selectedId: string | null;
  onSelect: (id: string) => void;
};

export default function AgreementQueue({ items, selectedId, onSelect }: AgreementQueueProps) {
  if (!items.length) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center text-sm text-slate-500">
        No agreements yet. Sync from deals to track agreement lifecycle.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[960px] text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-3">Deal #</th>
              <th className="px-3 py-3">Client</th>
              <th className="px-3 py-3">Type</th>
              <th className="px-3 py-3">Status</th>
              <th className="px-3 py-3">Scheduled</th>
              <th className="px-3 py-3">Expiry</th>
              <th className="px-3 py-3">Docs</th>
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
                  <td className="px-3 py-3">{AGREEMENT_TYPE_LABELS[r.agreementType]}</td>
                  <td className="px-3 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${selected ? 'bg-white/20 text-white' : agreementStatusTone(r.status)}`}>
                      {AGREEMENT_STATUS_LABELS[r.status]}
                    </span>
                  </td>
                  <td className="px-3 py-3">{formatOpsDate(r.scheduledDate)}</td>
                  <td className="px-3 py-3">{formatOpsDate(r.expiryDate)}</td>
                  <td className="px-3 py-3">{r.documentsComplete ? 'Complete' : 'Pending'}</td>
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
