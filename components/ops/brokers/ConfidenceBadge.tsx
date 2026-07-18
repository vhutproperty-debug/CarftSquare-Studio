'use client';

import { REVIEW_CONFIG } from '@/lib/ops/brokers/config';

export default function ConfidenceBadge({ value }: { value?: number }) {
  if (value == null) {
    return <span className="text-[11px] text-slate-400">—</span>;
  }

  if (value <= REVIEW_CONFIG.lowConfidenceMax) {
    return (
      <span className="inline-flex rounded-md border border-rose-200 bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700">
        Low Confidence · {value}%
      </span>
    );
  }

  const tone =
    value >= REVIEW_CONFIG.autoMergeMinOverall
      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
      : 'bg-amber-50 text-amber-700 border-amber-200';

  return (
    <span className={`inline-flex rounded-md border px-2 py-0.5 text-[11px] font-semibold ${tone}`}>
      {value}%
    </span>
  );
}
