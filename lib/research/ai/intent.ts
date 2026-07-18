import { parseResearchNaturalLanguage } from '@/lib/research/planner/parse-query';
import type { ResearchPlanCriteria } from '@/lib/research/types';

export type IntentResult = {
  criteriaDelta: Partial<ResearchPlanCriteria>;
  exclusions: string[];
  interpretedAs: string[];
  compareProjects: string[];
  needsClarification: boolean;
  clarificationQuestion?: string;
  isFollowUp: boolean;
};

const COMPARE_RE =
  /\bcompare\b|\bvs\.?\b|\bversus\b|\bdifference between\b|\bwhich is better\b/i;

/**
 * Deterministic intent understanding + session merge.
 * Optional LLM narrative is applied elsewhere; facts come from this parser.
 */
export function understandResearchIntent(
  message: string,
  previous?: ResearchPlanCriteria,
  previousExclusions: string[] = [],
): IntentResult {
  const text = message.trim();
  const isFollowUp = Boolean(previous && Object.keys(previous).length > 0);
  const { criteria, interpretedAs } = parseResearchNaturalLanguage(text);
  const exclusions = [...previousExclusions];
  const delta: Partial<ResearchPlanCriteria> = {};

  // Follow-up budget adjustments
  const bumpBudget = text.match(
    /\b(?:increase|raise|bump|set)\s+budget\s+(?:to\s+)?(?:rs\.?|₹)?\s*([\d,.]+)\s*(k|lakh|lac|l|cr)?\b/i,
  );
  if (bumpBudget) {
    const n = Number(bumpBudget[1].replace(/,/g, ''));
    const u = (bumpBudget[2] || '').toLowerCase();
    let amount = n;
    if (u === 'k') amount = n * 1000;
    else if (u.startsWith('l')) amount = n * 100_000;
    else if (u.startsWith('cr')) amount = n * 10_000_000;
    else if (n > 0 && n < 500) amount = n * 1000;
    delta.maxBudget = Math.round(amount);
    interpretedAs.push(`Budget max updated: ₹${delta.maxBudget.toLocaleString('en-IN')}`);
  }

  if (/\bonly\s+fully\s+furnished\b|\bfully\s+furnished\s+only\b/i.test(text)) {
    delta.furnishing = 'FURNISHED';
    interpretedAs.push('Furnishing filter: Fully furnished');
  } else if (/\bsemi[-\s]?furnished\b/i.test(text) && isFollowUp) {
    delta.furnishing = 'SEMI_FURNISHED';
    interpretedAs.push('Furnishing filter: Semi-furnished');
  } else if (/\bunfurnished\b/i.test(text) && isFollowUp) {
    delta.furnishing = 'UNFURNISHED';
    interpretedAs.push('Furnishing filter: Unfurnished');
  }

  const facing =
    text.match(/\b(only\s+)?(west|east|north|south)[-\s]?facing\b/i)
    || text.match(/\b(west|east|north|south)\s+facing\s+only\b/i);
  if (facing) {
    delta.facing = facing[2].toLowerCase();
    interpretedAs.push(`Facing: ${delta.facing}`);
  }

  if (/\bexclude\s+east[-\s]?facing\b|\bno\s+east[-\s]?facing\b/i.test(text)) {
    exclusions.push('east-facing');
    interpretedAs.push('Exclusion: east-facing');
  }
  if (/\bignore\s+broker\b|\bno\s+broker\b|\bonly\s+owner\b|\bowner\s+properties?\b/i.test(text)) {
    delta.listingSource = 'owner';
    interpretedAs.push('Source filter: owner only');
  }
  if (/\bonly\s+broker\b/i.test(text)) {
    delta.listingSource = 'broker';
    interpretedAs.push('Source filter: broker only');
  }
  if (/\bnewly\s+posted\b|\bposted\s+today\b|\bfresh\s+listings?\b/i.test(text)) {
    delta.postedSince = 'today';
    interpretedAs.push('Freshness: newly posted / today');
  }

  // Copy structured fields from NL parse when present.
  // On follow-ups, avoid re-applying parser defaults (city/portals/rent assumption).
  if (criteria.bhk != null) delta.bhk = criteria.bhk;
  if (criteria.maxBudget != null && !delta.maxBudget) delta.maxBudget = criteria.maxBudget;
  if (criteria.minBudget != null) delta.minBudget = criteria.minBudget;
  if (criteria.project) delta.project = criteria.project;
  if (criteria.locality) delta.locality = criteria.locality;
  if (criteria.furnishing && !delta.furnishing) delta.furnishing = criteria.furnishing;
  if (criteria.keywords?.length) delta.keywords = criteria.keywords;
  if (!isFollowUp) {
    if (criteria.transactionType) delta.transactionType = criteria.transactionType;
    if (criteria.city) delta.city = criteria.city;
    if (criteria.portals?.length) delta.portals = criteria.portals;
  } else if (/\b(sale|for sale|resale|buy|purchase|rentals?|for rent|on rent|\brent\b)\b/i.test(text)) {
    if (criteria.transactionType) delta.transactionType = criteria.transactionType;
  }

  const compareProjects = extractCompareProjects(text, criteria);
  if (compareProjects.length >= 2) {
    delta.projects = compareProjects;
    delta.project = undefined;
    interpretedAs.push(`Compare projects: ${compareProjects.join(' vs ')}`);
  }

  const mergedPreview = mergeCriteria(previous || {}, delta);
  const needsClarification =
    !isFollowUp
    && !mergedPreview.project
    && !mergedPreview.projects?.length
    && !mergedPreview.locality
    && mergedPreview.bhk == null
    && mergedPreview.maxBudget == null;

  return {
    criteriaDelta: delta,
    exclusions: Array.from(new Set(exclusions)),
    interpretedAs,
    compareProjects,
    needsClarification,
    clarificationQuestion: needsClarification
      ? 'To research accurately, please share configuration (e.g. 2 BHK), budget, and project or locality.'
      : undefined,
    isFollowUp,
  };
}

export function mergeCriteria(
  previous: ResearchPlanCriteria,
  delta: Partial<ResearchPlanCriteria>,
): ResearchPlanCriteria {
  return {
    ...previous,
    ...delta,
    portals: delta.portals?.length ? delta.portals : previous.portals,
    keywords: delta.keywords?.length
      ? Array.from(new Set([...(previous.keywords || []), ...delta.keywords]))
      : previous.keywords,
    projects: delta.projects?.length ? delta.projects : previous.projects,
    exclusions: delta.exclusions?.length
      ? Array.from(new Set([...(previous.exclusions || []), ...delta.exclusions]))
      : previous.exclusions,
  };
}

function extractCompareProjects(
  text: string,
  criteria: ResearchPlanCriteria,
): string[] {
  if (!COMPARE_RE.test(text) && !/\bwith\b.+\b(and|&)\b/i.test(text)) {
    return criteria.projects || [];
  }
  const known = [
    'Oberoi Sky City',
    'Rustomjee Summit',
    'Oberoi Esquire',
    'Oberoi Splendor',
    'Kalpataru Immensa',
    'Lodha Meridian',
    'Runwal Forests',
    'Wadhwa Atmosphere',
    'Piramal Revanta',
  ];
  const found = known.filter((p) => text.toLowerCase().includes(p.toLowerCase()));
  if (found.length >= 2) return found;

  const vs = text.match(
    /compare\s+(.+?)\s+(?:with|vs\.?|versus|and)\s+(.+?)(?:\.|$)/i,
  );
  if (vs) {
    return [vs[1].trim(), vs[2].trim()].filter((s) => s.length >= 3).slice(0, 3);
  }
  return found;
}
