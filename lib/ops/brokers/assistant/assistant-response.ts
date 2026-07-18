import type {
  AssistantListingCard,
  AssistantListingSource,
  AssistantSearchResponse,
  AssistantSearchState,
} from '@/lib/ops/brokers/assistant/types';

function formatMoney(value?: number): string {
  if (value == null) return '—';
  return `₹${value.toLocaleString('en-IN')}`;
}

function formatWhen(value?: string): string {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return value;
  }
}

export function toListingCards(sources: AssistantListingSource[]): AssistantListingCard[] {
  return sources.map(({ inventory, latestMessage }) => ({
    id: inventory.id,
    projectName: inventory.projectName,
    configuration: inventory.configuration,
    bhk: inventory.bhk,
    rent: inventory.rent,
    salePrice: inventory.salePrice,
    transactionType: inventory.transactionType,
    furnishing: inventory.furnishing,
    brokerName: inventory.brokerName,
    brokerPhone: inventory.brokerPhone,
    groupName: inventory.groupName,
    postedAt: inventory.lastSeenAt || inventory.lastMessageAt,
    overallConfidence: inventory.overallConfidence,
    freshnessStatus: inventory.freshnessStatus,
    originalMessage: latestMessage?.rawMessage
      ? latestMessage.rawMessage.replace(/\s+/g, ' ').trim()
      : undefined,
  }));
}

/**
 * Phase 1 deterministic answer. Phase 2 can replace this with an LLM call
 * while keeping the same AssistantSearchResponse contract.
 */
export function formatDeterministicAnswer(input: {
  total: number;
  interpretedAs: string[];
  listings: AssistantListingCard[];
  state: AssistantSearchState;
}): string {
  const { total, interpretedAs, listings } = input;
  if (total === 0) {
    return [
      'I couldn’t find matching listings for that.',
      interpretedAs.length ? `I looked for: ${interpretedAs.join(' · ')}.` : '',
      'Try broadening the query — for example drop the budget, or search a project name.',
    ]
      .filter(Boolean)
      .join(' ');
  }

  const lines = [
    `I found ${total} matching listing${total === 1 ? '' : 's'}.`,
    interpretedAs.length ? `Filters: ${interpretedAs.join(' · ')}.` : '',
    listings.length < total
      ? `Showing the ${listings.length} most recent below — refine with follow-ups like “only furnished” or “under 70k”.`
      : '',
  ].filter(Boolean);

  // Compact textual preview of top hits (UI also renders cards)
  const preview = listings.slice(0, 3).map((l, i) => {
    const price = l.rent != null ? formatMoney(l.rent) : l.salePrice != null ? formatMoney(l.salePrice) : '—';
    return `${i + 1}. ${l.projectName || 'Unknown'} · ${l.configuration || '—'} · ${price} · ${l.brokerName || 'Broker n/a'} (${formatWhen(l.postedAt)})`;
  });
  if (preview.length) {
    lines.push('', ...preview);
  }
  return lines.join('\n');
}

/** Extension point for Phase 2 (GPT/OpenAI response layer). */
export async function buildAssistantResponse(input: {
  total: number;
  interpretedAs: string[];
  sources: AssistantListingSource[];
  state: AssistantSearchState;
  responseMode?: 'deterministic' | 'llm';
}): Promise<AssistantSearchResponse> {
  const listings = toListingCards(input.sources);
  const mode = input.responseMode || 'deterministic';

  // Phase 2: if mode === 'llm', call model here with listings + query; fall back to deterministic.
  const answer = formatDeterministicAnswer({
    total: input.total,
    interpretedAs: input.interpretedAs,
    listings,
    state: input.state,
  });

  return {
    answer,
    state: input.state,
    interpretedAs: input.interpretedAs,
    total: input.total,
    listings,
    responseMode: mode,
  };
}
