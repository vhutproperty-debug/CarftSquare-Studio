'use client';

import { DEAL_STAGE_LABELS, stageTone } from '@/lib/ops/deals/statuses';
import type { DealStage } from '@/lib/ops/deals/statuses';

export default function DealStageBadge({ stage }: { stage: DealStage }) {
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${stageTone(stage)}`}>
      {DEAL_STAGE_LABELS[stage]}
    </span>
  );
}
