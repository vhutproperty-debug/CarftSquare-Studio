import type { ResearchPlanCriteria, ResearchScoredListing } from '@/lib/research/types';

/** Apply session exclusions / facing / source filters after scoring. */
export function applySessionFilters(
  listings: ResearchScoredListing[],
  criteria: ResearchPlanCriteria,
  exclusions: string[],
): ResearchScoredListing[] {
  return listings.filter((listing) => {
    const text = `${listing.title || ''} ${listing.rawText || ''}`.toLowerCase();

    for (const ex of exclusions) {
      const norm = ex.toLowerCase().replace(/-/g, ' ');
      if (norm.includes('facing')) {
        const dir = norm.replace(/facing/g, '').trim();
        if (listing.facing === dir) return false;
      } else if (text.includes(norm)) {
        return false;
      }
    }

    if (criteria.facing && listing.facing && listing.facing !== criteria.facing) {
      return false;
    }
    if (criteria.listingSource === 'owner' && listing.listingSource === 'broker') {
      return false;
    }
    if (criteria.listingSource === 'broker' && listing.listingSource === 'owner') {
      return false;
    }
    if (criteria.furnishing) {
      const want = criteria.furnishing.toLowerCase();
      const have = `${listing.furnishing || ''} ${text}`.toLowerCase();
      if (want.includes('semi') && !/semi/.test(have) && /furnish/.test(have)) return false;
      if (want === 'furnished' && /semi|unfurn/.test(have)) return false;
      if (want.includes('unfurn') && /fully\s*furnished|^furnished$/.test(have) && !/unfurn/.test(have)) {
        return false;
      }
    }
    return true;
  });
}
