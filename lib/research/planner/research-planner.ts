import { v4 as uuidv4 } from 'uuid';
import type { ResearchPlanner, ResearchPlan } from '@/agents/research-planner';
import { parseResearchNaturalLanguage } from '@/lib/research/planner/parse-query';
import type { ResearchPlanStep, ResearchQuery } from '@/lib/research/types';

/**
 * Deterministic ResearchPlanner — NL → Project / Budget / BHK / portals / steps.
 * No LLM (Phase 3).
 */
export class DeterministicResearchPlanner implements ResearchPlanner {
  readonly name = 'ResearchPlanner' as const;

  async buildPlan(query: ResearchQuery): Promise<ResearchPlan> {
    const { criteria, interpretedAs } = parseResearchNaturalLanguage(query.naturalLanguage);
    const portals = criteria.portals?.length
      ? criteria.portals
      : ['housing', 'magicbricks', '99acres', 'nobroker', 'squareyards'];

    const steps: ResearchPlanStep[] = [];
    for (const portal of portals) {
      steps.push(
        {
          id: uuidv4(),
          label: `Validate ${portal} session`,
          connectorKey: portal,
          action: 'validate_session',
        },
        {
          id: uuidv4(),
          label: `Search ${portal}`,
          connectorKey: portal,
          action: 'execute_search',
        },
        {
          id: uuidv4(),
          label: `Collect listings from ${portal}`,
          connectorKey: portal,
          action: 'collect_listings',
        },
      );
    }

    return {
      queryId: query.id,
      steps,
      criteria,
      interpretedAs,
    };
  }
}

export const researchPlanner = new DeterministicResearchPlanner();
