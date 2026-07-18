import type { BrokerFurnishing, BrokerFreshnessStatus, BrokerTransactionType } from '@/lib/ops/brokers/statuses';
import type { OpsBrokerInventory, OpsBrokerRawMessage } from '@/lib/ops/brokers/types';

/** Structured search state accumulated across a conversation (Phase 1 + 2). */
export type AssistantSearchState = {
  project?: string;
  locality?: string;
  bhk?: string;
  transactionType?: BrokerTransactionType | 'all';
  furnishing?: BrokerFurnishing | 'all';
  freshness?: BrokerFreshnessStatus | 'all';
  broker?: string;
  group?: string;
  minRent?: number;
  maxRent?: number;
  minSalePrice?: number;
  maxSalePrice?: number;
  /** Free-text keyword over structured fields. */
  search?: string;
  /** Keyword that must appear in original WhatsApp message. */
  messageKeyword?: string;
  postedSince?: 'today' | 'yesterday' | '7d';
  minConfidence?: number;
  maxConfidence?: number;
  page?: number;
  pageSize?: number;
};

export type AssistantListingCard = {
  id: string;
  projectName?: string;
  configuration?: string;
  bhk?: number;
  rent?: number;
  salePrice?: number;
  transactionType?: string;
  furnishing?: string;
  brokerName?: string;
  brokerPhone?: string;
  groupName?: string;
  postedAt?: string;
  overallConfidence?: number;
  freshnessStatus?: string;
  originalMessage?: string;
};

export type AssistantChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

/** Response contract — Phase 2 can swap `answer` generation without changing shape. */
export type AssistantSearchResponse = {
  answer: string;
  state: AssistantSearchState;
  interpretedAs: string[];
  total: number;
  listings: AssistantListingCard[];
  /** true when a future LLM layer can refine the answer text */
  responseMode: 'deterministic' | 'llm';
};

export type AssistantListingSource = {
  inventory: OpsBrokerInventory;
  latestMessage?: OpsBrokerRawMessage;
};
