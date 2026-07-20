import { getPortalMeta } from '@/lib/research/browser/config';
import type { ResearchPlanCriteria } from '@/lib/research/types';
import { slugifyProject } from '@/connectors/common/listing-parser';
import { buildHousingSearchEntryUrl } from '@/connectors/housing/housing-listings';

function citySlug(criteria: ResearchPlanCriteria): string {
  return slugifyProject(criteria.city || 'mumbai') || 'mumbai';
}

function projectQuery(criteria: ResearchPlanCriteria): string {
  return [criteria.project, criteria.locality].filter(Boolean).join(' ').trim()
    || criteria.keywords?.join(' ')
    || 'apartment';
}

/** Build a human-equivalent search URL for each supported portal. */
export function buildPortalSearchUrl(portal: string, criteria: ResearchPlanCriteria): string {
  const meta = getPortalMeta(portal);
  const origin = meta?.origin || 'https://housing.com';
  const city = citySlug(criteria);
  const q = encodeURIComponent(projectQuery(criteria));
  const bhk = criteria.bhk != null ? String(criteria.bhk) : '';
  const txn = criteria.transactionType === 'SALE' ? 'buy' : 'rent';

  switch (portal) {
    case 'housing':
      // Project searches need Housing autocomplete → rent-…-rpid-… SERP.
      // Query-param ?q= shells never render listing cards — entry URL only.
      return buildHousingSearchEntryUrl(criteria);
    case 'magicbricks':
      return txn === 'buy'
        ? `https://www.magicbricks.com/property-for-sale/residential-real-estate?proptype=Multistorey-Apartment,Builder-Floor-Apartment,Penthouse,Studio-Apartment&cityName=${encodeURIComponent(criteria.city || 'Mumbai')}&keyword=${q}`
        : `https://www.magicbricks.com/property-for-rent/residential-real-estate?proptype=Multistorey-Apartment,Builder-Floor-Apartment,Penthouse,Studio-Apartment&cityName=${encodeURIComponent(criteria.city || 'Mumbai')}&keyword=${q}`;
    case '99acres':
      return txn === 'buy'
        ? `https://www.99acres.com/search/property/buy/${city}?keyword=${q}${bhk ? `&bedroom_num=${bhk}` : ''}`
        : `https://www.99acres.com/search/property/rent/${city}?keyword=${q}${bhk ? `&bedroom_num=${bhk}` : ''}`;
    case 'nobroker':
      return `https://www.nobroker.in/${txn}/${city}?searchParam=${q}${bhk ? `&type=${bhk}bhk` : ''}`;
    case 'squareyards':
      return `https://www.squareyards.com/search?q=${q}&city=${encodeURIComponent(criteria.city || 'Mumbai')}&propertyType=Apartment&transaction=${txn === 'buy' ? 'Sale' : 'Rent'}`;
    default:
      return `${origin}/?q=${q}`;
  }
}
