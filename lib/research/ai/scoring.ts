import type { ResearchPlanCriteria, ResearchScoredListing } from '@/lib/research/types';

/**
 * Relevance scoring — every factor is derived from extracted listing fields + criteria.
 */
export function scoreListings(
  listings: ResearchScoredListing[],
  criteria: ResearchPlanCriteria,
  exclusions: string[] = [],
): ResearchScoredListing[] {
  const scored = listings
    .map((listing) => scoreOne(listing, criteria, exclusions))
    .filter((l) => !l.scoreBreakdown._excluded);
  scored.sort((a, b) => b.relevanceScore - a.relevanceScore);
  return scored;
}

function scoreOne(
  listing: ResearchScoredListing,
  criteria: ResearchPlanCriteria,
  exclusions: string[],
): ResearchScoredListing {
  const breakdown: Record<string, number> = {};
  const reasons: string[] = [];
  const text = `${listing.title || ''} ${listing.rawText || ''} ${listing.furnishing || ''}`.toLowerCase();

  if (exclusions.some((ex) => text.includes(ex.toLowerCase().replace(/-/g, ' ')) || matchesFacingExclusion(listing, ex))) {
    return {
      ...listing,
      relevanceScore: 0,
      scoreBreakdown: { _excluded: 1 },
      explanation: 'Excluded by your filter rules.',
    };
  }

  // Budget fit (0-25)
  const price = listing.rent ?? listing.salePrice;
  if (criteria.maxBudget != null && price != null) {
    if (price <= criteria.maxBudget) {
      const headroom = (criteria.maxBudget - price) / criteria.maxBudget;
      breakdown.budgetFit = Math.round(15 + Math.min(10, headroom * 20));
      reasons.push('within budget');
    } else {
      breakdown.budgetFit = Math.max(0, 10 - Math.round(((price - criteria.maxBudget) / criteria.maxBudget) * 20));
      reasons.push('above budget');
    }
  } else if (price != null) {
    breakdown.budgetFit = 12;
    reasons.push('price available');
  } else {
    breakdown.budgetFit = 5;
    reasons.push('price not extracted');
  }

  // Configuration (0-20)
  if (criteria.bhk != null) {
    if (listing.bhk === criteria.bhk) {
      breakdown.configuration = 20;
      reasons.push(`${listing.bhk} BHK match`);
    } else if (listing.bhk == null) {
      breakdown.configuration = 8;
      reasons.push('configuration not extracted');
    } else {
      breakdown.configuration = 2;
      reasons.push('different configuration');
    }
  } else {
    breakdown.configuration = listing.bhk != null ? 12 : 6;
  }

  // Furnishing (0-15)
  if (criteria.furnishing) {
    const want = criteria.furnishing.toLowerCase();
    const have = (listing.furnishing || text).toLowerCase();
    const match =
      (want.includes('semi') && /semi/.test(have))
      || (want === 'furnished' && /fully\s*furnished|furnished/.test(have) && !/semi|unfurn/.test(have))
      || (want.includes('unfurn') && /unfurn/.test(have));
    breakdown.furnishing = match ? 15 : /furnish/.test(have) ? 6 : 3;
    if (match) reasons.push('furnishing matches');
  } else {
    breakdown.furnishing = listing.furnishing ? 10 : 6;
  }

  // Location / project (0-15)
  const projectNeedle = (criteria.project || '').toLowerCase();
  const projects = criteria.projects || [];
  const hay = `${listing.projectName || ''} ${listing.title || ''} ${listing.locality || ''} ${listing.rawText || ''}`.toLowerCase();
  if (projectNeedle && hay.includes(projectNeedle.split(' ')[0]!)) {
    breakdown.location = 15;
    reasons.push('project match');
  } else if (projects.some((p) => hay.includes(p.toLowerCase().split(' ')[0]!))) {
    breakdown.location = 14;
    reasons.push('project in compare set');
  } else if (criteria.locality && hay.includes(criteria.locality.toLowerCase())) {
    breakdown.location = 12;
    reasons.push('locality match');
  } else {
    breakdown.location = 5;
  }

  // Facing (0-8)
  if (criteria.facing) {
    if (listing.facing === criteria.facing) {
      breakdown.facing = 8;
      reasons.push(`${criteria.facing}-facing`);
    } else if (!listing.facing) {
      breakdown.facing = 3;
    } else {
      breakdown.facing = 0;
    }
  } else {
    breakdown.facing = 4;
  }

  // Source (0-8)
  if (criteria.listingSource === 'owner') {
    breakdown.source = listing.listingSource === 'owner' ? 8 : listing.listingSource === 'unknown' ? 3 : 0;
    if (listing.listingSource === 'owner') reasons.push('owner listing');
  } else if (criteria.listingSource === 'broker') {
    breakdown.source = listing.listingSource === 'broker' ? 8 : 3;
  } else {
    breakdown.source = 5;
  }

  // Freshness (0-10)
  if (criteria.postedSince === 'today') {
    breakdown.freshness = /today|hours?\s+ago|just\s+now/i.test(text) ? 10 : 4;
    if (breakdown.freshness === 10) reasons.push('recently posted');
  } else {
    breakdown.freshness = /today|hours?\s+ago|just\s+now/i.test(text) ? 9 : /day|week/i.test(text) ? 6 : 5;
  }

  // Multi-portal confidence (0-10)
  const portalCount = listing.portalRefs?.length || 1;
  breakdown.sourceConfidence = Math.min(10, 4 + portalCount * 3);
  if (portalCount > 1) reasons.push(`available on ${portalCount} portals`);

  // Duplicate confidence already reflected via portal refs
  breakdown.duplicateConfidence = portalCount > 1 ? 8 : 5;

  // Price competitiveness among peers — soft mid score if within budget
  breakdown.priceCompetitiveness =
    criteria.maxBudget != null && price != null && price <= criteria.maxBudget * 0.9
      ? 8
      : 5;

  const total = Object.entries(breakdown)
    .filter(([k]) => !k.startsWith('_'))
    .reduce((sum, [, v]) => sum + v, 0);
  const maxPossible = 25 + 20 + 15 + 15 + 8 + 8 + 10 + 10 + 8 + 8;
  const relevanceScore = Math.round((total / maxPossible) * 100);

  return {
    ...listing,
    relevanceScore,
    scoreBreakdown: breakdown,
    explanation: buildExplanation(relevanceScore, reasons, portalCount),
  };
}

function matchesFacingExclusion(listing: ResearchScoredListing, exclusion: string): boolean {
  if (!/facing/i.test(exclusion)) return false;
  const dir = exclusion.toLowerCase().replace(/-facing|facing/g, '').trim();
  return Boolean(listing.facing && listing.facing === dir);
}

function buildExplanation(score: number, reasons: string[], portalCount: number): string {
  if (!reasons.length) {
    return `Relevance score ${score}/100 based on available extracted fields. Some attributes were not found on the listing.`;
  }
  const unique = Array.from(new Set(reasons));
  const because = unique.slice(0, 5).join(', ');
  const portalNote = portalCount > 1 ? ` Verified across ${portalCount} portals.` : '';
  return `This property scored ${score}/100 because it is ${because}.${portalNote}`;
}
