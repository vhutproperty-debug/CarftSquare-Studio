import type { NormalizedOpsLead } from '@/lib/ops/leads/types';
import type { OpsDemandRecord } from '@/lib/ops/demand/types';
import type { OpsSupplyRecord } from '@/lib/ops/supply/types';
import type { MatchProfile } from '@/lib/ops/matching/types';

function normalizeText(value?: string | null): string {
  return (value || '').trim().toLowerCase();
}

function extractNumber(value?: string | null): number | null {
  if (!value) return null;
  const digits = value.replace(/[^\d.]/g, '');
  if (!digits) return null;
  const num = Number(digits);
  return Number.isFinite(num) ? num : null;
}

function normalizeBhk(value?: string | null): string {
  const text = normalizeText(value);
  const match = text.match(/(\d)\s*bhk/i) || text.match(/(\d)/);
  return match ? `${match[1]}bhk` : text;
}

export function profileFromDemand(lead: NormalizedOpsLead, demand: OpsDemandRecord): MatchProfile {
  const q = demand.qualification;
  let transactionType = q.rentBuy === 'rent' || q.rentBuy === 'buy' ? q.rentBuy : undefined;
  if (!transactionType) {
    const intent = normalizeText(lead.intent || lead.requirement);
    if (intent.includes('rent')) transactionType = 'rent';
    else if (intent.includes('buy') || intent.includes('sale')) transactionType = 'buy';
  }

  return {
    transactionType,
    budget: extractNumber(q.budget || lead.budget),
    configuration: normalizeBhk(q.bhk || lead.requirement),
    project: normalizeText(lead.projectName),
    building: normalizeText(q.preferredBuildings || lead.location),
    furnishing: normalizeText(q.furnishing),
    parking: normalizeText(q.parkingRequirement),
    timeline: normalizeText(q.possessionTimeline),
    areaPreference: normalizeText(lead.location),
    notes: normalizeText(q.notes),
  };
}

export function profileFromSupply(supply: OpsSupplyRecord): MatchProfile {
  const transactionType = supply.listingType === 'rent'
    ? 'rent'
    : supply.listingType === 'sale'
      ? 'buy'
      : undefined;

  return {
    transactionType,
    budget: extractNumber(supply.listingType === 'sale' ? supply.expectedSalePrice : supply.expectedRent),
    configuration: normalizeBhk(supply.configuration),
    project: normalizeText(supply.project),
    building: normalizeText(supply.building),
    furnishing: normalizeText(supply.furnishedStatus),
    parking: normalizeText(supply.parking),
    timeline: normalizeText(supply.availableFrom || supply.possessionStatus || supply.availabilityStatus),
    areaPreference: normalizeText(supply.building || supply.project),
    notes: normalizeText(supply.internalNotes),
  };
}

export function profilesCompatible(demand: MatchProfile, supply: MatchProfile): boolean {
  if (demand.transactionType && supply.transactionType && demand.transactionType !== supply.transactionType) {
    return false;
  }
  return true;
}
