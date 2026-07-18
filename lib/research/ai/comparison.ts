import type { ResearchScoredListing } from '@/lib/research/types';

export type PropertyComparison = {
  listingIds: string[];
  rows: Array<{
    attribute: string;
    values: Array<string | number | undefined>;
  }>;
  strengths: Record<string, string[]>;
  weaknesses: Record<string, string[]>;
};

export function compareProperties(listings: ResearchScoredListing[]): PropertyComparison {
  const selected = listings.slice(0, 5);
  const ids = selected.map((l) => l.id);
  const strengths: Record<string, string[]> = {};
  const weaknesses: Record<string, string[]> = {};

  for (const listing of selected) {
    strengths[listing.id] = [];
    weaknesses[listing.id] = [];
  }

  const prices = selected.map((l) => l.rent ?? l.salePrice).filter((n): n is number => n != null);
  const minPrice = prices.length ? Math.min(...prices) : undefined;
  const maxScore = Math.max(...selected.map((l) => l.relevanceScore), 0);

  for (const listing of selected) {
    const price = listing.rent ?? listing.salePrice;
    if (price != null && minPrice != null && price === minPrice) {
      strengths[listing.id]!.push('Lowest asking price in comparison set');
    }
    if (listing.relevanceScore === maxScore && maxScore > 0) {
      strengths[listing.id]!.push('Highest relevance score');
    }
    if ((listing.portalRefs?.length || 1) > 1) {
      strengths[listing.id]!.push('Listed on multiple portals');
    }
    if (price == null) weaknesses[listing.id]!.push('Price not extracted');
    if (listing.carpetArea == null) weaknesses[listing.id]!.push('Carpet area not extracted');
    if (!listing.furnishing && !/furnish/i.test(listing.rawText || '')) {
      weaknesses[listing.id]!.push('Furnishing not clear');
    }
  }

  const rows: PropertyComparison['rows'] = [
    { attribute: 'Title', values: selected.map((l) => l.title || '—') },
    { attribute: 'Project', values: selected.map((l) => l.projectName || '—') },
    { attribute: 'Price', values: selected.map((l) => l.rent ?? l.salePrice ?? 'Not extracted') },
    { attribute: 'Carpet area', values: selected.map((l) => l.carpetArea ?? 'Not extracted') },
    {
      attribute: 'Rent / sq.ft',
      values: selected.map((l) => l.rentPerSqft ?? 'Not extracted'),
    },
    { attribute: 'BHK', values: selected.map((l) => l.bhk ?? 'Not extracted') },
    { attribute: 'Furnishing', values: selected.map((l) => l.furnishing || 'Not extracted') },
    { attribute: 'Facing', values: selected.map((l) => l.facing || 'Not extracted') },
    { attribute: 'Parking', values: selected.map((l) => l.parking || 'Not extracted') },
    { attribute: 'Broker/source', values: selected.map((l) => l.listingSource || 'unknown') },
    {
      attribute: 'Portals',
      values: selected.map((l) => (l.portalRefs || []).map((p) => p.portal).join(', ') || l.portal),
    },
    { attribute: 'Relevance', values: selected.map((l) => l.relevanceScore) },
    { attribute: 'Confidence note', values: selected.map((l) => l.explanation) },
  ];

  return { listingIds: ids, rows, strengths, weaknesses };
}

export function buildComparisonTable(
  listings: ResearchScoredListing[],
): Array<Record<string, string | number | undefined>> {
  return listings.slice(0, 10).map((l, idx) => ({
    rank: idx + 1,
    title: l.title || 'Listing',
    project: l.projectName || '—',
    price: l.rent ?? l.salePrice,
    bhk: l.bhk,
    furnishing: l.furnishing || 'Not extracted',
    facing: l.facing || 'Not extracted',
    portals: (l.portalRefs || []).map((p) => p.portal).join(', ') || l.portal,
    score: l.relevanceScore,
    explanation: l.explanation,
  }));
}
