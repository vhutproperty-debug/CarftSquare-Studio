import { buildComparisonTable } from '@/lib/research/ai/comparison';
import { deriveMarketInsights } from '@/lib/research/ai/insights';
import type {
  ResearchAiSession,
  ResearchPlanCriteria,
  ResearchReport,
  ResearchScoredListing,
} from '@/lib/research/types';

function money(n?: number): string {
  if (n == null) return 'not available from collected data';
  return `₹${n.toLocaleString('en-IN')}`;
}

export function buildResearchReport(input: {
  session: ResearchAiSession;
  listings: ResearchScoredListing[];
  duplicatesRemoved: number;
  portalsSearched: string[];
  portalErrors?: Array<{ portal: string; message: string }>;
}): ResearchReport {
  const { session, listings, duplicatesRemoved, portalsSearched, portalErrors = [] } = input;
  const criteria = session.filters;
  const topMatches = listings.slice(0, 8);
  const insights = deriveMarketInsights(listings);
  const warnings: string[] = [...insights.notes];

  if (portalErrors.length) {
    warnings.push(
      `Portal issues: ${portalErrors.map((e) => `${e.portal} (${e.message})`).join('; ')}`,
    );
  }
  if (!session.filters.portals?.length && !portalsSearched.length) {
    warnings.push('No portals were searched.');
  }
  const missingPrice = listings.filter((l) => l.rent == null && l.salePrice == null).length;
  if (missingPrice) {
    warnings.push(`${missingPrice} listing(s) missing extracted price — rankings for those are less certain.`);
  }

  const confidence = computeConfidence(listings, portalsSearched, portalErrors, duplicatesRemoved);

  const observations: string[] = [];
  const healthyPortals = portalsSearched.filter((p) => !portalErrors.some((e) => e.portal === p));
  if (healthyPortals.length || portalErrors.length) {
    observations.push(
      `Portal coverage: ${healthyPortals.length ? healthyPortals.join(', ') : 'none'} responded` +
        (portalErrors.length
          ? `; unavailable: ${portalErrors.map((e) => e.portal).join(', ')}`
          : '') +
        '.',
    );
  }
  if (topMatches[0]) {
    observations.push(
      `Top opportunity: ${topMatches[0].title || 'Listing'} (score ${topMatches[0].relevanceScore}/100). ${topMatches[0].explanation}`,
    );
  }
  if (topMatches.length > 1) {
    observations.push(
      `Next ranked options: ${topMatches
        .slice(1, 4)
        .map((l) => `${l.title || 'Listing'} (${l.relevanceScore})`)
        .join('; ')}.`,
    );
  }
  if (insights.averageAskingRent != null) {
    observations.push(
      `Price band from extracted rents: ${money(insights.minAskingRent)} – ${money(insights.maxAskingRent)} (avg ${money(insights.averageAskingRent)}, median ${money(insights.medianAskingRent)}).`,
    );
  }
  const brokerish = listings.filter((l) =>
    /broker|agent|dealer/i.test(`${l.broker || ''} ${l.title || ''} ${l.explanation || ''}`),
  ).length;
  if (brokerish) {
    observations.push(
      `${brokerish} listing(s) show broker/agent signals in extracted fields — treat as broker inventory unless confirmed owner.`,
    );
  }
  const withAmenities = listings.filter((l) => (l.amenities?.length || 0) > 0).length;
  if (withAmenities) {
    observations.push(
      `Amenities extracted for ${withAmenities}/${listings.length} listings; incomplete amenity data is common on portals.`,
    );
  }
  if (insights.duplicatePercentage > 0) {
    observations.push(
      `${insights.duplicatePercentage}% of unique properties appeared on more than one portal after alias matching.`,
    );
  }
  if (!observations.length) {
    observations.push('Insufficient extracted data to form strong observations.');
  }

  const nextSteps: string[] = [
    'Validate top matches with a site visit or broker call before sharing with the client.',
    'Confirm furnishing, facing, and parking directly — these fields are often incomplete on portals.',
  ];
  if (criteria.maxBudget != null) {
    nextSteps.push(`If inventory is thin, consider raising budget slightly above ${money(criteria.maxBudget)}.`);
  }
  if (portalErrors.length) {
    nextSteps.push('Re-authenticate failed portal sessions and re-run research for fuller coverage.');
  }
  if (healthyPortals.length && portalErrors.length) {
    nextSteps.push(
      `Research continued on healthy connectors (${healthyPortals.join(', ')}); reconnect failed portals for a full-market view.`,
    );
  }

  return {
    executiveSummary: buildExecutiveSummary(
      criteria,
      listings,
      topMatches,
      confidence,
      healthyPortals,
      portalErrors,
      duplicatesRemoved,
      insights,
    ),
    searchStrategy: buildSearchStrategy(session, portalsSearched),
    portalsSearched,
    listingsFound: listings.length + duplicatesRemoved,
    duplicatesRemoved,
    topMatches,
    comparisonTable: buildComparisonTable(topMatches),
    observations,
    marketInsights: insights,
    recommendedNextSteps: nextSteps,
    warnings,
    researchConfidence: confidence,
    generatedAt: new Date().toISOString(),
    metadata: {
      sessionId: session.id,
      workspaceId: session.workspaceId,
      naturalLanguageHistory: session.messages
        .filter((m) => m.role === 'user')
        .map((m) => m.content),
      criteria,
    },
  };
}

function buildExecutiveSummary(
  criteria: ResearchPlanCriteria,
  listings: ResearchScoredListing[],
  top: ResearchScoredListing[],
  confidence: number,
  healthyPortals: string[],
  portalErrors: Array<{ portal: string; message: string }>,
  duplicatesRemoved: number,
  insights: ReturnType<typeof deriveMarketInsights>,
): string {
  const target =
    criteria.projects?.join(' vs ')
    || criteria.project
    || criteria.locality
    || 'the requested area';
  const txn = criteria.transactionType === 'SALE' ? 'sale' : 'rent';
  const bhk = criteria.bhk != null ? `${criteria.bhk} BHK ` : '';
  const budget =
    criteria.maxBudget != null ? ` below ${money(criteria.maxBudget)}` : '';

  if (!listings.length) {
    return [
      `Research brief for ${bhk}${txn} options in ${target}${budget}.`,
      'No usable listings were collected from authenticated portals.',
      portalErrors.length
        ? `Unavailable portals: ${portalErrors.map((e) => e.portal).join(', ')}.`
        : 'Connected portals returned no matching inventory for the stated filters.',
      `Confidence ${confidence}/100. No fabricated inventory is shown.`,
    ].join(' ');
  }

  const lead = top[0];
  const coverage =
    healthyPortals.length > 0
      ? `Live coverage from ${healthyPortals.join(', ')}`
      : 'Limited portal coverage';
  const failover =
    portalErrors.length > 0
      ? ` Research continued despite ${portalErrors.length} portal failure(s) (${portalErrors.map((e) => e.portal).join(', ')}).`
      : '';
  const priceLine =
    insights.averageAskingRent != null
      ? ` Extracted asking rents average ${money(insights.averageAskingRent)} (range ${money(insights.minAskingRent)}–${money(insights.maxAskingRent)}).`
      : ' Price averages are withheld where rents were not extractable.';

  return [
    `Executive research brief: ${bhk}${txn} inventory in ${target}${budget}.`,
    `${coverage}; ${listings.length} unique propert${listings.length === 1 ? 'y' : 'ies'} after removing ${duplicatesRemoved} cross-portal duplicate(s).`,
    `Leading opportunity: “${lead?.title || 'Listing'}” (score ${lead?.relevanceScore}/100) — ${lead?.explanation || 'ranked from extracted portal fields only.'}`,
    priceLine.trim(),
    failover.trim(),
    `Overall research confidence ${confidence}/100 based only on extracted portal data.`,
  ]
    .filter(Boolean)
    .join(' ');
}

function buildSearchStrategy(session: ResearchAiSession, portals: string[]): string {
  const goals = session.goals.join('; ') || 'User-directed property research';
  const exclusions = session.exclusions.length
    ? ` Exclusions applied: ${session.exclusions.join(', ')}.`
    : '';
  const assumptions = session.assumptions.length
    ? ` Assumptions: ${session.assumptions.join('; ')}.`
    : '';
  return `${goals}. Portals: ${portals.join(', ') || 'none'}.${exclusions}${assumptions}`;
}

function computeConfidence(
  listings: ResearchScoredListing[],
  portals: string[],
  errors: Array<{ portal: string; message: string }>,
  duplicatesRemoved: number,
): number {
  if (!listings.length) return errors.length ? 20 : 35;
  let score = 55;
  score += Math.min(20, listings.length * 2);
  score += Math.min(15, portals.length * 3);
  score += Math.min(10, duplicatesRemoved > 0 ? 8 : 0);
  score -= Math.min(30, errors.length * 10);
  const priced = listings.filter((l) => l.rent != null || l.salePrice != null).length;
  score += Math.round((priced / listings.length) * 15);
  return Math.max(10, Math.min(95, score));
}
