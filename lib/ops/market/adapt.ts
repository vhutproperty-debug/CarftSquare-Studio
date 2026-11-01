import type { OpsProspect } from '@/lib/ops/calls/types';
import type { DemandQualification, OpsDemandRecord } from '@/lib/ops/demand/types';
import type { NormalizedOpsLead } from '@/lib/ops/leads/types';
import { demandKey } from '@/lib/ops/demand/types';
import { isAvailableStatus } from '@/lib/ops/supply/statuses';
import type { OpsSupplyRecord } from '@/lib/ops/supply/types';
import type { MarketFlat, MarketRequirement } from '@/lib/ops/market/types';
import {
  bhkLabel,
  extractFloorNumber,
  formatBudgetLabel,
  formatInr,
  furnishingLabel,
  normalizeBhk,
  normalizeFurnishing,
  normalizeTransaction,
  parseBudgetRange,
  parseInrAmount,
  type BudgetRange,
  type TransactionSide,
} from '@/lib/ops/market/normalize';
import { buildBrokerShareCard } from '@/lib/ops/market/share-card';

function places(...values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const list: string[] = [];
  for (const value of values) {
    const trimmed = value?.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    list.push(trimmed);
  }
  return list;
}

function isPropertyLead(lead: NormalizedOpsLead | null | undefined, qualification: DemandQualification, transaction: TransactionSide | null, bhk: string | null): boolean {
  if (transaction || bhk) return true;
  if (qualification.budget || qualification.budgetMin || qualification.budgetMax || qualification.preferredProject || qualification.locality) {
    return true;
  }
  const category = lead?.category;
  if (category === 'rental') return true;
  const text = `${lead?.intent || ''} ${lead?.requirement || ''}`.toLowerCase();
  return /\b(rent|lease|buy|sale|resale|bhk)\b/.test(text);
}

export function supplyToFlat(record: OpsSupplyRecord): MarketFlat | null {
  if (!isAvailableStatus(record.status) && record.status !== 'MATCHED') return null;

  const transaction = record.listingType === 'sale' ? 'sale' : record.listingType === 'rent' ? 'rent' : null;
  const amount = parseInrAmount(transaction === 'sale' ? record.expectedSalePrice : record.expectedRent);
  const bhkKey = normalizeBhk(record.configuration);
  const furnishing = normalizeFurnishing(record.furnishedStatus);
  const project = record.project?.trim() || '';
  const locality = record.locality?.trim() || '';
  const building = record.building?.trim() || '';
  const share = buildBrokerShareCard(record);
  const internalBits = [record.wing, record.flatNumber ? `Flat ${record.flatNumber}` : '', record.floor ? `Floor ${record.floor}` : '']
    .filter(Boolean);

  return {
    id: record.id,
    source: 'inventory',
    headline: [bhkLabel(bhkKey), project || building || 'Inventory'].filter((part) => part !== 'BHK on request' || !project).join(' · '),
    project,
    locality,
    building,
    preferredPlaces: places(project, locality, building),
    bhkLabel: bhkLabel(bhkKey),
    bhkKey,
    transaction,
    amount,
    amountLabel: amount != null ? `${formatInr(amount)}${transaction === 'rent' ? ' / month' : ''}` : 'Price not captured',
    furnishing,
    furnishingLabel: furnishingLabel(furnishing),
    statusLabel: record.status,
    internalRef: internalBits.join(' · '),
    href: '/ops/supply',
    share,
  };
}

export function prospectToFlat(prospect: OpsProspect): MarketFlat | null {
  if (prospect.prospectType !== 'homeowner' && prospect.prospectType !== 'rental_owner') return null;
  if (prospect.intent === 'interiors' || prospect.intent === 'not_now') return null;

  const text = `${prospect.requirement || ''} ${prospect.notes || ''}`;
  const transaction = prospect.listingType
    || (prospect.intent === 'rent' ? 'rent' : prospect.intent === 'sell' ? 'sale' : null)
    || (prospect.prospectType === 'rental_owner' ? 'rent' : null)
    || normalizeTransaction(text);
  if (!transaction) return null;

  const bhkKey = normalizeBhk(prospect.bhk) || normalizeBhk(text);
  const amount = parseInrAmount(transaction === 'sale' ? prospect.expectedSalePrice : prospect.expectedRent)
    ?? parseInrAmount(text);
  const furnishing = normalizeFurnishing(prospect.furnishing || text);
  const parsedFloor = extractFloorNumber(text, false);
  const floorSource = prospect.floor || (parsedFloor != null ? String(parsedFloor) : undefined);
  const project = prospect.projectName?.trim() || '';
  const locality = prospect.location?.trim() || '';
  const building = prospect.building?.trim() || '';
  const share = buildBrokerShareCard({
    configuration: prospect.bhk || text,
    floor: floorSource,
    furnishing: prospect.furnishing || text,
    project,
    locality,
    building,
    flatNumber: prospect.unit,
    ownerName: prospect.name,
    ownerMobile: prospect.phone,
    phone: prospect.alternatePhone,
    expectedRent: prospect.expectedRent,
    expectedSalePrice: prospect.expectedSalePrice,
  });

  return {
    id: `prospect:${prospect.id}`,
    source: 'prospect',
    headline: [bhkLabel(bhkKey), project || building || prospect.name || 'Owner flat'].join(' · '),
    project,
    locality,
    building,
    preferredPlaces: places(project, locality, building),
    bhkLabel: bhkLabel(bhkKey),
    bhkKey,
    transaction,
    amount,
    amountLabel: amount != null ? `${formatInr(amount)}${transaction === 'rent' ? ' / month' : ''}` : 'Price not captured',
    furnishing,
    furnishingLabel: furnishingLabel(prospect.furnishing || (furnishing === 'any' ? null : furnishing)),
    statusLabel: prospect.intent || prospect.prospectType,
    internalRef: [prospect.unit ? `Unit ${prospect.unit}` : '', prospect.floor ? `Floor ${prospect.floor}` : ''].filter(Boolean).join(' · '),
    href: `/ops/calls/${prospect.id}`,
    share,
  };
}

function requirementBudget(qualification: DemandQualification, lead?: NormalizedOpsLead | null): BudgetRange {
  const explicit = parseBudgetRange({
    budget: qualification.budget || lead?.budget,
    budgetMin: qualification.budgetMin,
    budgetMax: qualification.budgetMax,
  });
  if (explicit.min != null || explicit.max != null) return explicit;
  return parseBudgetRange({ budget: `${lead?.requirement || ''} ${lead?.intent || ''}` });
}

export function demandToRequirement(
  demand: Pick<OpsDemandRecord, 'source' | 'sourceId' | 'status' | 'qualification'> & { id?: string },
  lead?: NormalizedOpsLead | null,
): MarketRequirement | null {
  if (demand.status === 'LOST') return null;
  const qualification = demand.qualification || {};
  const text = `${lead?.requirement || ''} ${lead?.intent || ''} ${qualification.notes || ''}`;
  const transaction = qualification.rentBuy === 'rent'
    ? 'rent'
    : qualification.rentBuy === 'buy'
      ? 'sale'
      : normalizeTransaction(lead?.intent, lead?.requirement, qualification.notes);
  const bhkKey = normalizeBhk(qualification.bhk) || normalizeBhk(lead?.requirement) || normalizeBhk(text);
  if (!isPropertyLead(lead, qualification, transaction, bhkKey)) return null;

  const project = (qualification.preferredProject || lead?.projectName || '').trim();
  const locality = (qualification.locality || lead?.location || '').trim();
  const building = (qualification.preferredBuildings || '').trim();
  const budget = requirementBudget(qualification, lead);
  const furnishing = normalizeFurnishing(qualification.furnishing || text);
  const name = lead?.name?.trim() || 'Requirement';

  return {
    id: demandKey(demand.source, demand.sourceId),
    source: 'lead',
    headline: [name, bhkLabel(bhkKey), project || locality || 'Open location'].join(' · '),
    contactName: name,
    project,
    locality,
    building,
    preferredPlaces: places(project, locality, building),
    bhkLabel: bhkLabel(bhkKey),
    bhkKey,
    transaction,
    budget,
    budgetLabel: formatBudgetLabel(budget),
    furnishing,
    furnishingLabel: furnishing === 'any' ? 'Any furnishing' : furnishingLabel(furnishing),
    statusLabel: demand.status,
    href: `/ops/leads/${demand.source}/${demand.sourceId}`,
  };
}

export function prospectToRequirement(prospect: OpsProspect): MarketRequirement | null {
  if (prospect.prospectType !== 'tenant' && prospect.prospectType !== 'buyer') return null;
  if (prospect.intent === 'interiors' || prospect.intent === 'not_now') return null;

  const text = `${prospect.requirement || ''} ${prospect.notes || ''}`;
  const transaction = prospect.listingType
    || (prospect.intent === 'rent' ? 'rent' : prospect.intent === 'sell' ? 'sale' : null)
    || (prospect.prospectType === 'tenant' ? 'rent' : 'sale');
  const bhkKey = normalizeBhk(prospect.bhk) || normalizeBhk(text);
  const budget = parseBudgetRange({
    budget: prospect.budget || text,
    budgetMin: prospect.budgetMin,
    budgetMax: prospect.budgetMax,
  });
  const furnishing = normalizeFurnishing(prospect.furnishing || text);
  const project = prospect.projectName?.trim() || '';
  const locality = prospect.location?.trim() || '';
  const building = prospect.building?.trim() || '';
  const name = prospect.name?.trim() || (prospect.prospectType === 'tenant' ? 'Tenant' : 'Buyer');

  return {
    id: `prospect:${prospect.id}`,
    source: 'prospect',
    headline: [name, bhkLabel(bhkKey), project || locality || 'Open location'].join(' · '),
    contactName: name,
    project,
    locality,
    building,
    preferredPlaces: places(project, locality, building),
    bhkLabel: bhkLabel(bhkKey),
    bhkKey,
    transaction,
    budget,
    budgetLabel: formatBudgetLabel(budget),
    furnishing,
    furnishingLabel: furnishing === 'any' ? 'Any furnishing' : furnishingLabel(furnishing),
    statusLabel: prospect.intent || prospect.prospectType,
    href: `/ops/calls/${prospect.id}`,
  };
}
