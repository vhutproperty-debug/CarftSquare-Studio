import type { BrokerCrmIntent } from '@/lib/ops/broker-crm/types';

export type BudgetBand = {
  id: string;
  intent: BrokerCrmIntent;
  label: string;
  min: number;
  max: number | null;
};

export const BROKER_BUDGET_BANDS: BudgetBand[] = [
  { id: 'rent_under_40', intent: 'rent', label: 'Under ₹40k', min: 0, max: 40000 },
  { id: 'rent_40_60', intent: 'rent', label: '₹40–60k', min: 40000, max: 60000 },
  { id: 'rent_60_80', intent: 'rent', label: '₹60–80k', min: 60000, max: 80000 },
  { id: 'rent_80_120', intent: 'rent', label: '₹80k–1.2L', min: 80000, max: 120000 },
  { id: 'rent_120_200', intent: 'rent', label: '₹1.2–2L', min: 120000, max: 200000 },
  { id: 'rent_200_plus', intent: 'rent', label: '₹2L+', min: 200000, max: null },
  { id: 'buy_under_1cr', intent: 'buy', label: 'Under ₹1 Cr', min: 0, max: 10000000 },
  { id: 'buy_1_2', intent: 'buy', label: '₹1–2 Cr', min: 10000000, max: 20000000 },
  { id: 'buy_2_3', intent: 'buy', label: '₹2–3 Cr', min: 20000000, max: 30000000 },
  { id: 'buy_3_5', intent: 'buy', label: '₹3–5 Cr', min: 30000000, max: 50000000 },
  { id: 'buy_5_plus', intent: 'buy', label: '₹5 Cr+', min: 50000000, max: null },
];

export function budgetBandsFor(intent: BrokerCrmIntent): BudgetBand[] {
  return BROKER_BUDGET_BANDS.filter((band) => band.intent === intent);
}

export function findBudgetBand(id: string): BudgetBand | null {
  return BROKER_BUDGET_BANDS.find((band) => band.id === id) || null;
}
