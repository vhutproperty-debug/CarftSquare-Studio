import type { ResearchRun } from '@/lib/research/types';
import { researchExecutionEngine } from '@/lib/research/execution/research-execution-engine';
import { getResearchRunById, listResearchRuns } from '@/lib/research/store/runs';

/**
 * Application service for research runs.
 */
export interface ResearchRunService {
  start(queryId: string): Promise<ResearchRun>;
  getById(id: string): Promise<ResearchRun | null>;
  list(workspaceId: string): Promise<ResearchRun[]>;
}

export class DefaultResearchRunService implements ResearchRunService {
  async start(queryId: string): Promise<ResearchRun> {
    const { run } = await researchExecutionEngine.executeQuery(queryId);
    return run;
  }

  getById(id: string): Promise<ResearchRun | null> {
    return getResearchRunById(id);
  }

  list(workspaceId: string): Promise<ResearchRun[]> {
    return listResearchRuns(workspaceId);
  }
}

export const researchRunService = new DefaultResearchRunService();
