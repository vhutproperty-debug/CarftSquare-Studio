import { Badge } from '@/components/ui/badge';
import type { CallDisplayStatus } from '@/lib/ops/calls/statuses';
import { CALL_STATUS_LABELS } from '@/lib/ops/calls/statuses';

const STATUS_STYLES: Record<CallDisplayStatus, string> = {
  NOT_CALLED: 'bg-slate-100 text-slate-700',
  NO_ANSWER: 'bg-amber-100 text-amber-800',
  BUSY: 'bg-orange-100 text-orange-800',
  SWITCHED_OFF: 'bg-orange-100 text-orange-900',
  WRONG_NUMBER: 'bg-rose-100 text-rose-800',
  CALL_BACK: 'bg-blue-100 text-blue-800',
  CONNECTED: 'bg-cyan-100 text-cyan-900',
  INTERESTED: 'bg-emerald-100 text-emerald-800',
  NOT_INTERESTED: 'bg-slate-200 text-slate-700',
  FOLLOW_UP: 'bg-violet-100 text-violet-800',
  DO_NOT_CALL: 'bg-red-100 text-red-800',
  CONVERTED: 'bg-green-100 text-green-900',
};

type CallStatusBadgeProps = {
  status: CallDisplayStatus;
};

export default function CallStatusBadge({ status }: CallStatusBadgeProps) {
  return (
    <Badge variant="secondary" className={`font-medium ${STATUS_STYLES[status]}`}>
      {CALL_STATUS_LABELS[status]}
    </Badge>
  );
}
