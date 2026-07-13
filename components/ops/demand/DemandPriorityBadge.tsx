import { Badge } from '@/components/ui/badge';
import type { DemandPriority } from '@/lib/ops/demand/statuses';
import { DEMAND_PRIORITY_LABELS } from '@/lib/ops/demand/statuses';

const STYLES: Record<DemandPriority, string> = {
  HIGH: 'bg-red-100 text-red-800 ring-red-200',
  MEDIUM: 'bg-amber-100 text-amber-900 ring-amber-200',
  LOW: 'bg-slate-100 text-slate-700 ring-slate-200',
};

export default function DemandPriorityBadge({
  priority,
  overdue,
}: {
  priority: DemandPriority;
  overdue?: boolean;
}) {
  return (
    <Badge
      variant="secondary"
      className={`font-semibold ring-1 ${STYLES[priority]} ${overdue ? 'animate-pulse ring-red-400' : ''}`}
    >
      {DEMAND_PRIORITY_LABELS[priority]}
      {overdue ? ' · Overdue' : ''}
    </Badge>
  );
}
