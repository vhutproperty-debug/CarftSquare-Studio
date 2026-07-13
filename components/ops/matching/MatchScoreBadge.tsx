'use client';

import { scoreTone } from '@/lib/ops/matching/statuses';

export default function MatchScoreBadge({ score }: { score: number }) {
  const tone = scoreTone(score);
  const classes = {
    high: 'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-300',
    medium: 'bg-amber-100 text-amber-900 ring-1 ring-amber-300',
    low: 'bg-slate-100 text-slate-700',
  };

  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-black tabular-nums ${classes[tone]}`}>
      {score}%
    </span>
  );
}
