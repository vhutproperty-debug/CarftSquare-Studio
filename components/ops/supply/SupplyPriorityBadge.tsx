'use client';

import type { SupplyPriority } from '@/lib/ops/supply/statuses';
import { SUPPLY_PRIORITY_LABELS } from '@/lib/ops/supply/statuses';

export default function SupplyPriorityBadge({
  priority,
  overdue,
}: {
  priority: SupplyPriority;
  overdue?: boolean;
}) {
  const tones: Record<SupplyPriority, string> = {
    HIGH: overdue ? 'bg-red-100 text-red-800 ring-1 ring-red-300' : 'bg-orange-100 text-orange-800',
    MEDIUM: 'bg-amber-100 text-amber-800',
    LOW: 'bg-slate-100 text-slate-600',
  };

  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${tones[priority]}`}>
      {SUPPLY_PRIORITY_LABELS[priority]}
    </span>
  );
}
