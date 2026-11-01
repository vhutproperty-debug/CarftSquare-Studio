import type { BrokerShareCard } from '@/lib/ops/market/share-card';
import type { BudgetRange, FurnishingClass, TransactionSide } from '@/lib/ops/market/normalize';

export type MarketFlat = {
  id: string;
  source: 'inventory' | 'prospect';
  headline: string;
  project: string;
  locality: string;
  building: string;
  preferredPlaces: string[];
  bhkLabel: string;
  bhkKey: string | null;
  transaction: TransactionSide | null;
  amount: number | null;
  amountLabel: string;
  furnishing: FurnishingClass;
  furnishingLabel: string;
  statusLabel: string;
  /** Ops-only reference. Never copied onto the broker share card. */
  internalRef: string;
  href: string;
  share: BrokerShareCard;
};

export type MarketRequirement = {
  id: string;
  source: 'lead' | 'prospect';
  headline: string;
  contactName: string;
  project: string;
  locality: string;
  building: string;
  preferredPlaces: string[];
  bhkLabel: string;
  bhkKey: string | null;
  transaction: TransactionSide | null;
  budget: BudgetRange;
  budgetLabel: string;
  furnishing: FurnishingClass;
  furnishingLabel: string;
  statusLabel: string;
  href: string;
};

export type MarketMatch = {
  flatId: string;
  requirementId: string;
  reasons: string[];
};

export type GapAction = 'push_ads' | 'broker_outreach' | 'balanced';

export type GapRow = {
  key: string;
  project: string;
  bhk: string;
  rentFlats: number;
  rentRequirements: number;
  rentGap: number;
  rentAction: GapAction;
  saleFlats: number;
  saleRequirements: number;
  saleGap: number;
  saleAction: GapAction;
};

export type MarketOverview = {
  flats: MarketFlat[];
  requirements: MarketRequirement[];
  matches: MarketMatch[];
  flatsWithoutDemand: string[];
  requirementsWithoutSupply: string[];
  gap: GapRow[];
  summary: {
    availableFlats: number;
    activeRequirements: number;
    matchedFlats: number;
    matchedRequirements: number;
    flatsWithoutDemand: number;
    requirementsWithoutSupply: number;
    pushAdsCells: number;
    brokerOutreachCells: number;
  };
};
