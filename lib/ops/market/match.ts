import type {
  GapAction,
  GapRow,
  MarketFlat,
  MarketMatch,
  MarketOverview,
  MarketRequirement,
} from '@/lib/ops/market/types';
import {
  amountInBudget,
  anyPlaceOverlap,
  furnishingCompatible,
  furnishingLabel,
  transactionLabel,
} from '@/lib/ops/market/normalize';

function gapAction(flats: number, requirements: number): GapAction {
  const gap = flats - requirements;
  if (gap > 0) return 'push_ads';
  if (gap < 0) return 'broker_outreach';
  return 'balanced';
}

export function matchReasons(flat: MarketFlat, requirement: MarketRequirement): string[] | null {
  if (!flat.transaction || !requirement.transaction || flat.transaction !== requirement.transaction) {
    return null;
  }
  if (!flat.bhkKey || !requirement.bhkKey || flat.bhkKey !== requirement.bhkKey) {
    return null;
  }
  if (!amountInBudget(flat.amount, requirement.budget)) return null;
  const demandPlaces = requirement.preferredPlaces;
  const supplyPlaces = flat.preferredPlaces;
  if (demandPlaces.length && supplyPlaces.length && !anyPlaceOverlap(demandPlaces, supplyPlaces)) {
    return null;
  }
  if (demandPlaces.length && !supplyPlaces.length) return null;
  if (!furnishingCompatible(requirement.furnishing, flat.furnishing)) return null;

  const place = flat.project || flat.locality || flat.building || requirement.project || requirement.locality;
  const reasons = [
    flat.bhkLabel,
    flat.transaction === 'rent' ? 'Rent within budget' : 'Price within budget',
    transactionLabel(flat.transaction),
    place ? place : 'Location open',
    requirement.furnishing === 'any' ? 'Furnishing open' : furnishingLabel(flat.furnishing),
  ];
  return reasons;
}

function placeBucket(project: string, locality: string, building: string): string {
  const primary = project.trim();
  const area = locality.trim();
  if (primary && area && primary.toLowerCase() !== area.toLowerCase() && !primary.toLowerCase().includes(area.toLowerCase())) {
    return `${primary} · ${area}`;
  }
  return primary || area || building.trim() || 'Unspecified location';
}

export function buildGapRows(flats: MarketFlat[], requirements: MarketRequirement[]): GapRow[] {
  const buckets = new Map<string, GapRow>();

  function rowFor(project: string, locality: string, building: string, bhk: string): GapRow {
    const place = placeBucket(project, locality, building);
    const key = `${place.toLowerCase()}|${bhk.toLowerCase()}`;
    const existing = buckets.get(key);
    if (existing) return existing;
    const created: GapRow = {
      key,
      project: place,
      bhk,
      rentFlats: 0,
      rentRequirements: 0,
      rentGap: 0,
      rentAction: 'balanced',
      saleFlats: 0,
      saleRequirements: 0,
      saleGap: 0,
      saleAction: 'balanced',
    };
    buckets.set(key, created);
    return created;
  }

  for (const flat of flats) {
    if (!flat.transaction) continue;
    const row = rowFor(flat.project, flat.locality, flat.building, flat.bhkLabel);
    if (flat.transaction === 'rent') row.rentFlats += 1;
    else row.saleFlats += 1;
  }

  for (const requirement of requirements) {
    if (!requirement.transaction) continue;
    const row = rowFor(requirement.project, requirement.locality, requirement.building, requirement.bhkLabel);
    if (requirement.transaction === 'rent') row.rentRequirements += 1;
    else row.saleRequirements += 1;
  }

  const rows = Array.from(buckets.values()).map((row) => {
    row.rentGap = row.rentFlats - row.rentRequirements;
    row.saleGap = row.saleFlats - row.saleRequirements;
    row.rentAction = gapAction(row.rentFlats, row.rentRequirements);
    row.saleAction = gapAction(row.saleFlats, row.saleRequirements);
    return row;
  });

  rows.sort((a, b) => {
    const score = (row: GapRow) => Math.max(Math.abs(row.rentGap), Math.abs(row.saleGap));
    const diff = score(b) - score(a);
    if (diff !== 0) return diff;
    return a.project.localeCompare(b.project) || a.bhk.localeCompare(b.bhk);
  });
  return rows;
}

export function buildMarketOverview(flats: MarketFlat[], requirements: MarketRequirement[]): MarketOverview {
  const matches: MarketMatch[] = [];
  const flatHits = new Set<string>();
  const requirementHits = new Set<string>();

  for (const flat of flats) {
    for (const requirement of requirements) {
      const reasons = matchReasons(flat, requirement);
      if (!reasons) continue;
      matches.push({ flatId: flat.id, requirementId: requirement.id, reasons });
      flatHits.add(flat.id);
      requirementHits.add(requirement.id);
    }
  }

  const flatsWithoutDemand = flats.filter((flat) => !flatHits.has(flat.id)).map((flat) => flat.id);
  const requirementsWithoutSupply = requirements
    .filter((requirement) => !requirementHits.has(requirement.id))
    .map((requirement) => requirement.id);
  const gap = buildGapRows(flats, requirements);

  return {
    flats,
    requirements,
    matches,
    flatsWithoutDemand,
    requirementsWithoutSupply,
    gap,
    summary: {
      availableFlats: flats.length,
      activeRequirements: requirements.length,
      matchedFlats: flatHits.size,
      matchedRequirements: requirementHits.size,
      flatsWithoutDemand: flatsWithoutDemand.length,
      requirementsWithoutSupply: requirementsWithoutSupply.length,
      pushAdsCells: gap.reduce((sum, row) => sum + (row.rentAction === 'push_ads' ? 1 : 0) + (row.saleAction === 'push_ads' ? 1 : 0), 0),
      brokerOutreachCells: gap.reduce((sum, row) => sum + (row.rentAction === 'broker_outreach' ? 1 : 0) + (row.saleAction === 'broker_outreach' ? 1 : 0), 0),
    },
  };
}
