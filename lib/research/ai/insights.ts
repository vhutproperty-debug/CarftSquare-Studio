import type { ResearchMarketInsights, ResearchScoredListing } from '@/lib/research/types';

/** Derive market insights only from collected listings — never invent values. */
export function deriveMarketInsights(listings: ResearchScoredListing[]): ResearchMarketInsights {
  const rents = listings
    .map((l) => l.rent)
    .filter((n): n is number => typeof n === 'number' && Number.isFinite(n))
    .sort((a, b) => a - b);

  const portalDistribution: Record<string, number> = {};
  const inventoryByProject: Record<string, number> = {};
  let multiPortal = 0;

  for (const listing of listings) {
    for (const ref of listing.portalRefs || [{ portal: listing.portal }]) {
      portalDistribution[ref.portal] = (portalDistribution[ref.portal] || 0) + 1;
    }
    if ((listing.portalRefs?.length || 1) > 1) multiPortal += 1;
    const project = listing.projectName || listing.title?.slice(0, 40) || 'Unknown';
    inventoryByProject[project] = (inventoryByProject[project] || 0) + 1;
  }

  const notes: string[] = [];
  if (!rents.length) {
    notes.push('Asking rents could not be derived — price was missing on collected listings.');
  }
  if (!listings.length) {
    notes.push('No listings were collected in this research session.');
  }

  const avg = rents.length
    ? Math.round(rents.reduce((a, b) => a + b, 0) / rents.length)
    : undefined;
  const median = rents.length ? rents[Math.floor(rents.length / 2)] : undefined;

  const outlierListingIds: string[] = [];
  if (avg != null && rents.length >= 4) {
    for (const listing of listings) {
      if (listing.rent != null && (listing.rent > avg * 1.4 || listing.rent < avg * 0.6)) {
        outlierListingIds.push(listing.id);
      }
    }
    if (outlierListingIds.length) {
      notes.push(`${outlierListingIds.length} listing(s) appear as price outliers vs session average.`);
    }
  }

  const duplicatePercentage =
    listings.length > 0
      ? Math.round((multiPortal / listings.length) * 100)
      : 0;

  return {
    averageAskingRent: avg,
    medianAskingRent: median,
    minAskingRent: rents[0],
    maxAskingRent: rents[rents.length - 1],
    listingCount: listings.length,
    uniquePropertyCount: listings.length,
    duplicatePercentage,
    portalDistribution,
    inventoryByProject,
    outlierListingIds,
    notes,
  };
}
