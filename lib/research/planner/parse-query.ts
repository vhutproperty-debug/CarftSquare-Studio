import { RESEARCH_PORTALS } from '@/lib/research/browser/config';
import type { ResearchPlanCriteria, ResearchTransactionType } from '@/lib/research/types';

const KNOWN_PROJECTS = [
  'Oberoi Sky City',
  'Oberoi Esquire',
  'Oberoi Splendor',
  'Kalpataru Immensa',
  'Kalpataru Avana',
  'Lodha Meridian',
  'Lodha Park',
  'Runwal Forests',
  'Runwal Bliss',
  'Wadhwa Atmosphere',
  'Piramal Revanta',
  'Hiranandani Gardens',
  'Raheja Vistas',
];

const KNOWN_LOCALITIES = [
  'Goregaon West',
  'Goregaon East',
  'Malad West',
  'Malad East',
  'Andheri West',
  'Andheri East',
  'Powai',
  'Bandra West',
  'Bandra East',
  'Juhu',
  'Versova',
  'Kandivali West',
  'Kandivali East',
  'Borivali West',
  'Borivali East',
  'Thane',
  'Lower Parel',
  'Worli',
];

function parseMoneyToken(raw: string, unit?: string): number | undefined {
  const n = Number(raw.replace(/,/g, ''));
  if (!Number.isFinite(n)) return undefined;
  const u = (unit || '').toLowerCase();
  if (u === 'k') return Math.round(n * 1000);
  if (u.startsWith('l')) return Math.round(n * 100_000);
  if (u.startsWith('cr')) return Math.round(n * 10_000_000);
  if (n > 0 && n < 500 && !u) return Math.round(n * 1000);
  return Math.round(n);
}

/**
 * Deterministic NL → structured research criteria (no LLM).
 * Example: "2 BHK rent Oberoi Sky City below 80000"
 */
export function parseResearchNaturalLanguage(input: string): {
  criteria: ResearchPlanCriteria;
  interpretedAs: string[];
} {
  const interpretedAs: string[] = [];
  const criteria: ResearchPlanCriteria = {
    city: 'Mumbai',
    portals: RESEARCH_PORTALS.map((p) => p.key),
  };
  let text = input.trim();
  if (!text) {
    return { criteria, interpretedAs: ['Empty query'] };
  }

  if (/\b(rentals?|for rent|on rent|rental|\brent\b)\b/i.test(text)) {
    criteria.transactionType = 'RENT';
    interpretedAs.push('Transaction: Rent');
    text = text.replace(/\b(rentals?|for rent|on rent|rental|\brent\b)\b/gi, ' ');
  } else if (/\b(sale|for sale|resale|buy|purchase)\b/i.test(text)) {
    criteria.transactionType = 'SALE';
    interpretedAs.push('Transaction: Sale');
    text = text.replace(/\b(sale|for sale|resale|buy|purchase)\b/gi, ' ');
  } else {
    criteria.transactionType = 'RENT' as ResearchTransactionType;
    interpretedAs.push('Transaction: Rent (default)');
  }

  const bhkMatch = text.match(/\b(\d(?:\.\d)?)\s*bhk\b/i);
  if (bhkMatch) {
    criteria.bhk = Number(bhkMatch[1]);
    interpretedAs.push(`BHK: ${criteria.bhk}`);
    text = text.replace(bhkMatch[0], ' ');
  }

  if (/\bsemi[-\s]?furnished\b/i.test(text)) {
    criteria.furnishing = 'SEMI_FURNISHED';
    interpretedAs.push('Furnishing: Semi-furnished');
    text = text.replace(/\bsemi[-\s]?furnished\b/gi, ' ');
  } else if (/\b(fully\s+)?furnished\b/i.test(text)) {
    criteria.furnishing = 'FURNISHED';
    interpretedAs.push('Furnishing: Furnished');
    text = text.replace(/\b(fully\s+)?furnished\b/gi, ' ');
  } else if (/\bunfurnished\b/i.test(text)) {
    criteria.furnishing = 'UNFURNISHED';
    interpretedAs.push('Furnishing: Unfurnished');
    text = text.replace(/\bunfurnished\b/gi, ' ');
  }

  const under = text.match(
    /\b(?:below|under|less than|upto|up to|max(?:imum)?|budget(?:\s+under)?)\s*(?:rs\.?|₹)?\s*([\d,.]+)\s*(k|lakh|lac|l|cr)?\b/i,
  );
  if (under) {
    const amount = parseMoneyToken(under[1], under[2]);
    if (amount != null) {
      criteria.maxBudget = amount;
      interpretedAs.push(`Budget max: ₹${amount.toLocaleString('en-IN')}`);
      text = text.replace(under[0], ' ');
    }
  }
  const above = text.match(
    /\b(?:above|over|more than|min(?:imum)?)\s*(?:rs\.?|₹)?\s*([\d,.]+)\s*(k|lakh|lac|l|cr)?\b/i,
  );
  if (above) {
    const amount = parseMoneyToken(above[1], above[2]);
    if (amount != null) {
      criteria.minBudget = amount;
      interpretedAs.push(`Budget min: ₹${amount.toLocaleString('en-IN')}`);
      text = text.replace(above[0], ' ');
    }
  }

  const portalMentions = RESEARCH_PORTALS.filter((p) =>
    text.toLowerCase().includes(p.key.replace(/\d/g, '').toLowerCase())
    || text.toLowerCase().includes(p.displayName.toLowerCase()),
  );
  if (portalMentions.length) {
    criteria.portals = portalMentions.map((p) => p.key);
    interpretedAs.push(`Portals: ${portalMentions.map((p) => p.displayName).join(', ')}`);
    for (const p of portalMentions) {
      text = text.replace(new RegExp(p.displayName, 'ig'), ' ');
      text = text.replace(new RegExp(p.key, 'ig'), ' ');
    }
  }

  const lower = text.toLowerCase();
  const project = KNOWN_PROJECTS.find((p) => lower.includes(p.toLowerCase()));
  if (project) {
    criteria.project = project;
    interpretedAs.push(`Project: ${project}`);
    text = text.replace(new RegExp(project.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'ig'), ' ');
  }

  const locality = KNOWN_LOCALITIES.find((l) => lower.includes(l.toLowerCase()));
  if (locality) {
    criteria.locality = locality;
    interpretedAs.push(`Locality: ${locality}`);
    text = text.replace(new RegExp(locality.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'ig'), ' ');
  }

  const cleaned = text
    .replace(/\b(show|me|find|any|all|listings?|inventory|available|in|for|the|a|an|only|with|please|search|property|properties)\b/gi, ' ')
    .replace(/[?!.]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (cleaned.length >= 3) {
    if (!criteria.project) {
      criteria.project = cleaned;
      interpretedAs.push(`Project: ${cleaned}`);
    } else if (!criteria.locality) {
      criteria.locality = cleaned;
      interpretedAs.push(`Locality: ${cleaned}`);
    } else {
      criteria.keywords = [cleaned];
      interpretedAs.push(`Keywords: ${cleaned}`);
    }
  }

  if (!interpretedAs.length) {
    interpretedAs.push('Broad portal search');
  }

  return { criteria, interpretedAs };
}
