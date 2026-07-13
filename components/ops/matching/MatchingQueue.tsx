'use client';

import MatchCard from '@/components/ops/matching/MatchCard';
import MatchScoreBadge from '@/components/ops/matching/MatchScoreBadge';
import type { MatchQueueItem } from '@/lib/ops/matching/types';
import { MATCH_STATUS_LABELS } from '@/lib/ops/matching/statuses';

type MatchingQueueProps = {
  items: MatchQueueItem[];
  selectedId: string | null;
  onSelect: (item: MatchQueueItem) => void;
};

export default function MatchingQueue({ items, selectedId, onSelect }: MatchingQueueProps) {
  if (!items.length) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center text-sm text-slate-500">
        No matches yet. Generate matches from eligible demand and supply.
      </div>
    );
  }

  return (
    <>
      <div className="grid gap-3 md:hidden">
        {items.map((item) => (
          <MatchCard
            key={item.id}
            item={item}
            selected={selectedId === item.id}
            onClick={() => onSelect(item)}
          />
        ))}
      </div>

      <div className="hidden overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm md:block">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-3">Score</th>
                <th className="px-3 py-3">Demand</th>
                <th className="px-3 py-3">Supply</th>
                <th className="px-3 py-3">Project</th>
                <th className="px-3 py-3">Config</th>
                <th className="px-3 py-3">Type</th>
                <th className="px-3 py-3">Reasons</th>
                <th className="px-3 py-3">Broker</th>
                <th className="px-3 py-3">Status</th>
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
                    <td className="px-3 py-3">
                      {!selected ? <MatchScoreBadge score={item.match.score} /> : (
                        <span className="text-sm font-black text-emerald-300">{item.match.score}%</span>
                      )}
                    </td>
                    <td className="px-3 py-3 font-semibold">{item.demand.name || 'Unknown'}</td>
                    <td className="max-w-[160px] truncate px-3 py-3">{item.supply.label}</td>
                    <td className="max-w-[120px] truncate px-3 py-3">{item.demand.projectName || item.supply.project || '—'}</td>
                    <td className="px-3 py-3">{item.demand.qualification.bhk || item.supply.configuration || '—'}</td>
                    <td className="px-3 py-3 text-xs uppercase">{item.supply.listingType || '—'}</td>
                    <td className="max-w-[200px] truncate px-3 py-3 text-xs">
                      {item.match.reasons.slice(0, 2).join(' · ') || '—'}
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
                    <td className="px-3 py-3 text-xs font-semibold">
                      {MATCH_STATUS_LABELS[item.match.status]}
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
