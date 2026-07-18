import type {
  ResearchPlanCriteria,
  ResearchPlanStep,
  ResearchQuery,
} from '@/lib/research/types';

export type { ResearchPlanStep };

export type ResearchPlan = {
  queryId: string;
  steps: ResearchPlanStep[];
  criteria: ResearchPlanCriteria;
  interpretedAs: string[];
};

/**
 * Turns a research query into an executable plan.
 * Phase 2: deterministic NL → Project / Budget / BHK / portals / steps.
 */
export interface ResearchPlanner {
  readonly name: 'ResearchPlanner';
  buildPlan(query: ResearchQuery): Promise<ResearchPlan>;
}
