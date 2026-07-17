import { Badge } from '@/components/ui/badge';
import type { OpsLeadCategory, OpsLeadSource } from '@/lib/ops/leads/types';
import { OPS_LEAD_CATEGORY_LABELS, OPS_LEAD_SOURCE_LABELS } from '@/lib/ops/leads/types';

const SOURCE_STYLES: Record<OpsLeadSource, string> = {
  homepage: 'bg-slate-100 text-slate-700',
  painting: 'bg-sky-100 text-sky-800',
  auris_serenity: 'bg-violet-100 text-violet-800',
  satellite_elegance: 'bg-indigo-100 text-indigo-800',
  designer_callback: 'bg-amber-100 text-amber-800',
  quotation: 'bg-emerald-100 text-emerald-800',
  housing_com: 'bg-orange-100 text-orange-800',
  housing: 'bg-orange-100 text-orange-900',
};

type LeadSourceBadgeProps = {
  source: OpsLeadSource;
};

export default function LeadSourceBadge({ source }: LeadSourceBadgeProps) {
  return (
    <Badge variant="secondary" className={`font-medium ${SOURCE_STYLES[source]}`}>
      {OPS_LEAD_SOURCE_LABELS[source]}
    </Badge>
  );
}

type LeadCategoryBadgeProps = {
  category: OpsLeadCategory;
};

export function LeadCategoryBadge({ category }: LeadCategoryBadgeProps) {
  return (
    <Badge variant="outline" className="font-medium capitalize">
      {OPS_LEAD_CATEGORY_LABELS[category]}
    </Badge>
  );
}
