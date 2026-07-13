import { Badge } from '@/components/ui/badge';
import type { DemandStatus } from '@/lib/ops/demand/statuses';
import { DEMAND_STATUS_LABELS } from '@/lib/ops/demand/statuses';

const STYLES: Record<DemandStatus, string> = {
  NEW: 'bg-blue-100 text-blue-800',
  CONTACTED: 'bg-cyan-100 text-cyan-900',
  QUALIFIED: 'bg-emerald-100 text-emerald-800',
  FOLLOW_UP: 'bg-violet-100 text-violet-800',
  SITE_VISIT: 'bg-indigo-100 text-indigo-800',
  READY_FOR_MATCHING: 'bg-green-100 text-green-900',
  LOST: 'bg-slate-200 text-slate-600',
};

export default function DemandStatusBadge({ status }: { status: DemandStatus }) {
  return (
    <Badge variant="secondary" className={`font-semibold ${STYLES[status]}`}>
      {DEMAND_STATUS_LABELS[status]}
    </Badge>
  );
}
