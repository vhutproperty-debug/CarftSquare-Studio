'use client';

import ConfidenceBadge from '@/components/ops/brokers/ConfidenceBadge';
import type { BrokerInventoryQueueItem } from '@/lib/ops/brokers/types';
import {
  BROKER_FRESHNESS_LABELS,
  BROKER_TRANSACTION_LABELS,
} from '@/lib/ops/brokers/statuses';

function formatMoney(value?: number): string {
  if (value == null) return '—';
  if (value >= 10_000_000) return `₹${(value / 10_000_000).toFixed(2)} Cr`;
  if (value >= 100_000) return `₹${(value / 100_000).toFixed(1)} L`;
  return `₹${value.toLocaleString('en-IN')}`;
}

function formatDate(value?: string): string {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
    });
  } catch {
    return '—';
  }
}

function FreshnessBadge({ status }: { status: BrokerInventoryQueueItem['freshnessStatus'] }) {
  const tone =
    status === 'FRESH'
      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
      : status === 'AGING'
        ? 'bg-amber-50 text-amber-700 border-amber-200'
        : 'bg-rose-50 text-rose-700 border-rose-200';
  return (
    <span className={`inline-flex rounded-md border px-2 py-0.5 text-[11px] font-semibold ${tone}`}>
      {BROKER_FRESHNESS_LABELS[status]}
    </span>
  );
}

type Props = {
  items: BrokerInventoryQueueItem[];
  loading: boolean;
  onSelect: (item: BrokerInventoryQueueItem) => void;
};

export default function BrokersQueueTable({ items, loading, onSelect }: Props) {
  if (loading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
        Loading broker inventory…
      </div>
    );
  }

  if (!items.length) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-white p-10 text-center">
        <p className="text-sm font-semibold text-slate-800">No broker inventory yet</p>
        <p className="mt-1 text-sm text-slate-500">
          Import a WhatsApp group .txt export to start building searchable inventory.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-100 bg-slate-50 text-[11px] font-bold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Freshness</th>
              <th className="px-4 py-3">Conf.</th>
              <th className="px-4 py-3">Project</th>
              <th className="px-4 py-3">Config</th>
              <th className="px-4 py-3">Tower / Unit</th>
              <th className="px-4 py-3">Price</th>
              <th className="px-4 py-3">Furnishing</th>
              <th className="px-4 py-3">Broker</th>
              <th className="px-4 py-3">Group</th>
              <th className="px-4 py-3">Last seen</th>
              <th className="px-4 py-3">×</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const price =
                item.transactionType === 'SALE'
                  ? formatMoney(item.salePrice)
                  : formatMoney(item.rent);
              const towerUnit = [item.tower || item.wing, item.unitNumber].filter(Boolean).join(' · ') || '—';
              return (
                <tr
                  key={item.id}
                  className="cursor-pointer border-b border-slate-50 hover:bg-slate-50/80"
                  onClick={() => onSelect(item)}
                >
                  <td className="px-4 py-3"><FreshnessBadge status={item.freshnessStatus} /></td>
                  <td className="px-4 py-3"><ConfidenceBadge value={item.overallConfidence} /></td>
                  <td className="px-4 py-3">
                    <div className="font-semibold text-slate-900">{item.projectName || '—'}</div>
                    <div className="text-[11px] text-slate-400">
                      {BROKER_TRANSACTION_LABELS[item.transactionType]}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{item.configuration || '—'}</td>
                  <td className="px-4 py-3 text-slate-700">{towerUnit}</td>
                  <td className="px-4 py-3 font-medium text-slate-900">{price}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {item.furnishing === 'UNKNOWN' ? '—' : item.furnishing.replace(/_/g, ' ')}
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-slate-800">{item.brokerName || '—'}</div>
                    {item.brokerPhone ? (
                      <div className="text-[11px] text-slate-400">{item.brokerPhone}</div>
                    ) : null}
                  </td>
                  <td className="max-w-[140px] truncate px-4 py-3 text-slate-600" title={item.groupName}>
                    {item.groupName}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{formatDate(item.lastSeenAt)}</td>
                  <td className="px-4 py-3 font-semibold text-slate-800">{item.occurrenceCount}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
