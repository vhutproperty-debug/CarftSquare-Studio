'use client';

import MatchScoreBadge from '@/components/ops/matching/MatchScoreBadge';
import type { MatchQueueItem } from '@/lib/ops/matching/types';
import { MATCH_STATUS_LABELS } from '@/lib/ops/matching/statuses';

type MatchCardProps = {
  item: MatchQueueItem;
  selected?: boolean;
  onClick: () => void;
};

export default function MatchCard({ item, selected, onClick }: MatchCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition-colors hover:bg-slate-50 ${
        selected ? 'ring-2 ring-slate-900' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-slate-900">{item.demand.name || 'Demand enquiry'}</p>
          <p className="text-xs text-slate-500">→ {item.supply.label}</p>
        </div>
        <MatchScoreBadge score={item.match.score} />
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {item.match.reasons.slice(0, 3).map((reason) => (
          <span key={reason} className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
            {reason}
          </span>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
        <span>{MATCH_STATUS_LABELS[item.match.status]}</span>
        {item.assigneeInitials ? (
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-200 text-[10px] font-bold text-slate-700">
            {item.assigneeInitials}
          </span>
        ) : null}
      </div>
    </button>
  );
}
