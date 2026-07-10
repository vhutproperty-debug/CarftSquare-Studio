import { Badge } from '@/components/ui/badge';

type LeadStatusBadgeProps = {
  status?: string | null;
};

export default function LeadStatusBadge({ status }: LeadStatusBadgeProps) {
  const label = status?.trim() || 'unknown';
  const normalized = label.toLowerCase();

  let className = 'bg-slate-100 text-slate-700';
  if (normalized === 'new') className = 'bg-blue-100 text-blue-800';
  if (['contacted', 'qualified', 'meeting_scheduled', 'site_visit'].includes(normalized)) {
    className = 'bg-amber-100 text-amber-800';
  }
  if (['won', 'converted', 'closed'].includes(normalized)) {
    className = 'bg-emerald-100 text-emerald-800';
  }
  if (['lost', 'closed'].includes(normalized) && normalized === 'lost') {
    className = 'bg-rose-100 text-rose-800';
  }

  return (
    <Badge variant="secondary" className={`font-medium capitalize ${className}`}>
      {label.replace(/_/g, ' ')}
    </Badge>
  );
}
