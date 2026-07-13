'use client';

import { probabilityTone } from '@/lib/ops/deals/statuses';

export default function DealProbabilityBadge({ probability }: { probability: number }) {
  const tone = probabilityTone(probability);
  const classes = {
    high: 'bg-emerald-100 text-emerald-800',
    medium: 'bg-amber-100 text-amber-900',
    low: 'bg-slate-100 text-slate-700',
  };

  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-black tabular-nums ${classes[tone]}`}>
      {probability}%
    </span>
  );
}
