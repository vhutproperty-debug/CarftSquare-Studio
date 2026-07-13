'use client';

import type { OpsPillarId } from '@/lib/ops/business';
import { OPS_PILLARS } from '@/lib/ops/business';

const PILLAR_STYLES: Record<OpsPillarId, string> = {
  demand: 'bg-blue-50 text-blue-800 ring-blue-200',
  supply: 'bg-orange-50 text-orange-800 ring-orange-200',
  revenue: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  profit: 'bg-violet-50 text-violet-800 ring-violet-200',
};

type BusinessTypeBadgeProps = {
  pillar: OpsPillarId;
  label: string;
  size?: 'sm' | 'md';
};

export default function BusinessTypeBadge({ pillar, label, size = 'sm' }: BusinessTypeBadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full font-bold uppercase tracking-wide ring-1 ${PILLAR_STYLES[pillar]} ${
        size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs'
      }`}
      title={OPS_PILLARS[pillar].description}
    >
      {label}
    </span>
  );
}
