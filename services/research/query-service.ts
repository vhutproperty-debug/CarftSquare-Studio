import type { ResearchQuery } from '@/lib/research/types';
import { researchExecutionEngine } from '@/lib/research/execution/research-execution-engine';
import {
  getResearchQueryById,
  listResearchQueries,
} from '@/lib/research/store/queries';

/**
 * Application service for research queries.
 */
export interface ResearchQueryService {
  create(input: {
    workspaceId: string;
    title: string;
    naturalLanguage: string;
    createdBy: string;
  }): Promise<ResearchQuery>;
  getById(id: string): Promise<ResearchQuery | null>;
  list(workspaceId: string): Promise<ResearchQuery[]>;
}

export class DefaultResearchQueryService implements ResearchQueryService {
  async create(input: {
    workspaceId: string;
    title: string;
    naturalLanguage: string;
    createdBy: string;
  }): Promise<ResearchQuery> {
    const { query } = await researchExecutionEngine.planAndCreateQuery({
      workspaceId: input.workspaceId,
      naturalLanguage: input.naturalLanguage,
      createdBy: input.createdBy,
      title: input.title,
    });
    return query;
  }

  getById(id: string): Promise<ResearchQuery | null> {
    return getResearchQueryById(id);
  }

  list(workspaceId: string): Promise<ResearchQuery[]> {
    return listResearchQueries(workspaceId);
  }
}

export const researchQueryService = new DefaultResearchQueryService();
