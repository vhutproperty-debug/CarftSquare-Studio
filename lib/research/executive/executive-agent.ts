import type { ExecutiveAgent } from '@/agents/executive-agent';
import { researchExecutionEngine } from '@/lib/research/execution/research-execution-engine';
import { researchPlanner } from '@/lib/research/planner/research-planner';
import { updateResearchQuery } from '@/lib/research/store/queries';
import { setResearchRunStatus } from '@/lib/research/store/runs';
import type { ResearchQuery, ResearchRun } from '@/lib/research/types';

/**
 * Coordinates planning + execution for Prop/Research.
 */
export class DefaultExecutiveAgent implements ExecutiveAgent {
  readonly name = 'ExecutiveAgent' as const;

  async plan(query: ResearchQuery): Promise<ResearchRun> {
    const built = await researchPlanner.buildPlan(query);
    await updateResearchQuery(query.id, {
      plan: {
        criteria: built.criteria,
        steps: built.steps,
        interpretedAs: built.interpretedAs,
      },
      status: 'queued',
    });
    const { run } = await researchExecutionEngine.executeQuery(query.id);
    return run;
  }

  async cancel(runId: string): Promise<void> {
    await setResearchRunStatus(runId, 'cancelled', {
      finishedAt: new Date().toISOString(),
    });
  }
}

export const executiveAgent = new DefaultExecutiveAgent();
