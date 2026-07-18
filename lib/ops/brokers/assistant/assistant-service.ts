import {
  buildAssistantResponse,
} from '@/lib/ops/brokers/assistant/assistant-response';
import { searchInventoryForAssistant } from '@/lib/ops/brokers/assistant/assistant-search';
import {
  mergeAssistantState,
  parseNaturalLanguageQuery,
} from '@/lib/ops/brokers/assistant/nl-parser';
import type {
  AssistantSearchResponse,
  AssistantSearchState,
} from '@/lib/ops/brokers/assistant/types';
import { getDatabase, getWorkspaceAggregates } from '@/lib/ops/brokers/store';

/**
 * Orchestrates: NL parse → structured search → conversational answer.
 * Does not touch import/extract/dedupe pipelines.
 */
export async function runBrokerAssistantTurn(input: {
  message: string;
  previousState?: AssistantSearchState;
}): Promise<AssistantSearchResponse> {
  const db = await getDatabase();
  const aggregates = await getWorkspaceAggregates(db);
  const knownProjects = aggregates.projects || [];

  const { delta, interpretedAs, reset } = parseNaturalLanguageQuery(
    input.message,
    knownProjects,
  );
  const state = mergeAssistantState(input.previousState, delta, reset);
  const { total, sources } = await searchInventoryForAssistant(state);

  return buildAssistantResponse({
    total,
    interpretedAs,
    sources,
    state,
    responseMode: 'deterministic',
  });
}
