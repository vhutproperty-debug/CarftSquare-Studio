import type { ResearchQuery, ResearchRun } from '@/lib/research/types';

/**
 * Coordinates research planning and agent orchestration.
 * Phase 1: interface contract only — no runtime implementation.
 */
export interface ExecutiveAgent {
  readonly name: 'ExecutiveAgent';
  plan(query: ResearchQuery): Promise<ResearchRun>;
  cancel(runId: string): Promise<void>;
}
