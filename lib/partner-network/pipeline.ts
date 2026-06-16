import { LEAD_STATUSES } from '@/lib/partner-network/constants';
import type { LeadStatus } from '@/lib/partner-network/types';

/** Single pipeline definition shared by Admin CRM and Partner Dashboard. */
export const LEAD_PIPELINE = LEAD_STATUSES;

export type LeadPipelineStage = LeadStatus;
export type LeadStageState = 'completed' | 'active' | 'inactive';

export function getLeadStageIndex(status: string): number {
  const idx = LEAD_PIPELINE.indexOf(status as LeadPipelineStage);
  return idx >= 0 ? idx : 0;
}

export function getLeadStageState(stageIndex: number, currentIndex: number): LeadStageState {
  if (stageIndex < currentIndex) return 'completed';
  if (stageIndex === currentIndex) return 'active';
  return 'inactive';
}

export function formatLeadStageLabel(stage: string): string {
  return stage.replace(/_/g, ' ');
}
