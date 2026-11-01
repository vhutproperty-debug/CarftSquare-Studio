import { findBudgetBand } from '@/lib/ops/broker-crm/bands';
import { isDoNotContact } from '@/lib/ops/broker-crm/privacy';
import type { OpsBrokerCrmRecord } from '@/lib/ops/broker-crm/types';
import { bhkLabel, normalizeBhk } from '@/lib/ops/market/normalize';
import type { MarketRequirement } from '@/lib/ops/market/types';

const OPEN_STATUSES = new Set(['new', 'contacted', 'active']);

/**
 * Broker demand for the Market board.
 * Only BHK, budget band, area/project, and rent/buy are copied.
 * Notes, phone, flat numbers, owner details, and commercial terms are left behind.
 * Dormant and do-not-contact brokers are not demand.
 */
export function brokerRecordsToMarketRequirements(records: OpsBrokerCrmRecord[]): MarketRequirement[] {
  const requirements: MarketRequirement[] = [];
  for (const record of records) {
    if (isDoNotContact(record) || !OPEN_STATUSES.has(record.status)) continue;
    for (const item of record.requirements) {
      if (!item.active) continue;
      const band = findBudgetBand(item.budgetBandId);
      if (!band || band.intent !== item.intent) continue;
      const bhkKey = normalizeBhk(item.bhk);
      const project = item.project.trim();
      const locality = item.area.trim();
      const places = [project, locality].filter(Boolean);
      requirements.push({
        id: `broker:${record.id}:${item.id}`,
        source: 'broker',
        headline: [record.name, bhkLabel(bhkKey), project || locality || 'Open location'].join(' · '),
        contactName: record.name,
        project,
        locality,
        building: '',
        preferredPlaces: places,
        bhkLabel: bhkLabel(bhkKey),
        bhkKey,
        transaction: item.intent === 'buy' ? 'sale' : 'rent',
        budget: { min: band.min, max: band.max },
        budgetLabel: band.label,
        furnishing: 'any',
        furnishingLabel: 'Any furnishing',
        statusLabel: record.status,
        href: `/ops/broker-crm/${record.id}`,
      });
    }
  }
  return requirements;
}
