/**
 * Shared parsers for supply–demand matching.
 * Budget strings already stored on leads stay valid; explicit min/max win when present.
 */

export type FurnishingClass = 'furnished' | 'semifurnished' | 'unfurnished' | 'any';

export type BudgetRange = {
  min: number | null;
  max: number | null;
};

const GENERIC_PLACE_TOKENS = new Set([
  'west',
  'east',
  'north',
  'south',
  'road',
  'marg',
  'nagar',
  'mumbai',
  'near',
  'opp',
  'the',
  'and',
  'for',
  'bhk',
  'flat',
  'floor',
  'wing',
  'tower',
  'phase',
  'sector',
]);

function unitMultiplier(unit?: string | null): number | null {
  if (!unit) return null;
  const value = unit.toLowerCase();
  if (value === 'cr' || value.startsWith('crore')) return 10000000;
  if (value === 'k') return 1000;
  if (value === 'l' || value.startsWith('lac') || value.startsWith('lakh')) return 100000;
  return null;
}

function applyUnit(amount: number, unit?: string | null, fallback?: string | null): number | null {
  if (!Number.isFinite(amount)) return null;
  const multiplier = unitMultiplier(unit) ?? unitMultiplier(fallback);
  if (multiplier) return Math.round(amount * multiplier);
  if (amount >= 1000) return Math.round(amount);
  return null;
}

/** A single rent or price. A real budget band returns null so it is not treated as one figure. */
export function parseInrAmount(raw?: string | number | null): number | null {
  if (typeof raw === 'number') {
    return Number.isFinite(raw) && raw >= 1000 ? Math.round(raw) : null;
  }
  if (raw == null || String(raw).trim() === '') return null;
  const text = String(raw).replace(/,/g, '');
  const ranged = parseBudgetText(text);
  const looksLikeRange = /\d\s*(?:cr|crores?|lakhs?|lacs?|l|k)?\s*(?:-|–|—|\bto\b)\s*\d/i.test(text);
  if (looksLikeRange && ranged.min != null && ranged.max != null && ranged.min !== ranged.max) return null;
  return ranged.max;
}

export function parseBudgetRange(input: {
  budget?: string | number | null;
  budgetMin?: string | number | null;
  budgetMax?: string | number | null;
}): BudgetRange {
  const explicitMin = parseSingleAmount(input.budgetMin);
  const explicitMax = parseSingleAmount(input.budgetMax);
  if (explicitMin != null || explicitMax != null) {
    if (explicitMin != null && explicitMax != null && explicitMin > explicitMax) {
      return { min: explicitMax, max: explicitMin };
    }
    if (explicitMin != null && explicitMax == null) {
      return { min: explicitMin, max: null };
    }
    return { min: explicitMin != null ? explicitMin : Math.round((explicitMax as number) * 0.5), max: explicitMax };
  }

  return parseBudgetText(input.budget);
}

function bareMoneyAmount(text: string): number | null {
  const labeled = text.match(/(?:rent|budget|price|deposit|rs\.?|inr)\D{0,8}(\d{4,8})\b/i);
  if (labeled) {
    const amount = Number(labeled[1]);
    if (Number.isFinite(amount) && amount >= 1000) return amount;
  }
  const matches = [...text.matchAll(/\b(\d{4,8})\b/g)];
  for (const match of matches) {
    const amount = Number(match[1]);
    if (!Number.isFinite(amount) || amount < 1000) continue;
    const index = match.index ?? 0;
    const around = text.slice(Math.max(0, index - 14), index + match[1].length + 8).toLowerCase();
    if (/\b(flat|unit|wing|floor|flr|bhk|tower)\b/.test(around)) continue;
    return amount;
  }
  return null;
}

function parseSingleAmount(raw?: string | number | null): number | null {
  if (raw == null || raw === '') return null;
  if (typeof raw === 'number') {
    return Number.isFinite(raw) && raw > 0 ? Math.round(raw) : null;
  }
  return parseBudgetText(raw).max;
}

function parseBudgetText(raw?: string | number | null): BudgetRange {
  if (raw == null || raw === '') return { min: null, max: null };
  if (typeof raw === 'number') {
    if (!Number.isFinite(raw) || raw < 1000) return { min: null, max: null };
    return { min: Math.round(raw * 0.5), max: Math.round(raw) };
  }

  const text = String(raw).replace(/,/g, '').replace(/₹/g, ' ').trim();
  if (!text) return { min: null, max: null };

  const range = text.match(
    /(\d+(?:\.\d+)?)\s*(cr|crores?|lakhs?|lacs?|l|k)?\s*(?:-|–|—|\bto\b)\s*(\d+(?:\.\d+)?)\s*(cr|crores?|lakhs?|lacs?|l|k)?/i,
  );
  if (range) {
    const left = applyUnit(Number(range[1]), range[2], range[4]);
    const right = applyUnit(Number(range[3]), range[4], range[2]);
    if (left != null && right != null) {
      return { min: Math.min(left, right), max: Math.max(left, right) };
    }
  }

  const withUnit = text.match(/(\d+(?:\.\d+)?)\s*(cr|crores?|lakhs?|lacs?|l|k)\b/i);
  if (withUnit) {
    const amount = applyUnit(Number(withUnit[1]), withUnit[2]);
    if (amount != null) return { min: Math.round(amount * 0.5), max: amount };
  }

  const rupee = text.match(/(?:₹|rs\.?|inr)\s*(\d+(?:\.\d+)?)/i);
  if (rupee) {
    const amount = applyUnit(Number(rupee[1]));
    if (amount != null) return { min: Math.round(amount * 0.5), max: amount };
  }

  const bare = bareMoneyAmount(text);
  if (bare != null) return { min: Math.round(bare * 0.5), max: bare };

  return { min: null, max: null };
}

export function amountInBudget(amount: number | null, range: BudgetRange): boolean {
  if (amount == null || !Number.isFinite(amount)) return false;
  if (range.min == null && range.max == null) return false;
  if (range.min != null && amount < range.min) return false;
  if (range.max != null && amount > range.max) return false;
  return true;
}

export function formatInr(amount: number): string {
  return `₹${Math.round(amount).toLocaleString('en-IN')}`;
}

export function formatBudgetLabel(range: BudgetRange): string {
  if (range.min == null && range.max == null) return 'Budget open';
  if (range.min != null && range.max != null) {
    if (range.min === range.max) return formatInr(range.max);
    const singleCeiling = range.min === Math.round(range.max * 0.5);
    if (singleCeiling) return `Up to ${formatInr(range.max)}`;
    return `${formatInr(range.min)} – ${formatInr(range.max)}`;
  }
  if (range.max != null) return `Up to ${formatInr(range.max)}`;
  return `${formatInr(range.min as number)}+`;
}

export function normalizeBhk(value?: string | number | null): string | null {
  if (value == null) return null;
  const text = String(value).trim().toLowerCase();
  if (!text) return null;
  if (text.includes('studio')) return 'studio';
  const rk = text.match(/(\d+(?:\.\d+)?)\s*rk\b/);
  if (rk) return `${trimTrailingZero(rk[1])}rk`;
  const bhk = text.match(/(\d+(?:\.\d+)?)\s*bhk\b/);
  if (bhk) return `${trimTrailingZero(bhk[1])}bhk`;
  if (/^\d+(?:\.\d+)?$/.test(text)) return `${trimTrailingZero(text)}bhk`;
  return null;
}

function trimTrailingZero(value: string): string {
  return value.replace(/\.0$/, '');
}

export function bhkLabel(key: string | null): string {
  if (!key) return 'BHK on request';
  if (key === 'studio') return 'Studio';
  if (key.endsWith('rk')) return `${key.replace('rk', '')} RK`;
  if (key.endsWith('bhk')) return `${key.replace('bhk', '')} BHK`;
  return 'BHK on request';
}

export function normalizeFurnishing(value?: string | null): FurnishingClass {
  const text = (value || '').trim().toLowerCase();
  if (!text || text === 'any' || text.includes('either') || text.includes('no preference')) return 'any';
  if (text.includes('unfurnish') || text.includes('un-furnish') || /\buf\b/.test(text) || text.includes('bare')) {
    return 'unfurnished';
  }
  if (text.includes('semi')) return 'semifurnished';
  if (text.includes('furnish') || /\bff\b/.test(text)) return 'furnished';
  return 'any';
}

export function furnishingLabel(value: FurnishingClass | string | null | undefined): string {
  const cls = typeof value === 'string' && (value === 'furnished' || value === 'semifurnished' || value === 'unfurnished' || value === 'any')
    ? value
    : normalizeFurnishing(value);
  if (cls === 'furnished') return 'Furnished';
  if (cls === 'semifurnished') return 'Semi-furnished';
  if (cls === 'unfurnished') return 'Unfurnished';
  return 'Furnishing on request';
}

export function furnishingCompatible(demand: FurnishingClass, supply: FurnishingClass): boolean {
  if (demand === 'any') return true;
  if (supply === 'any') return false;
  return demand === supply;
}

export type TransactionSide = 'rent' | 'sale';

export function normalizeTransaction(...values: Array<string | null | undefined>): TransactionSide | null {
  const text = values.filter(Boolean).join(' ').toLowerCase();
  if (!text.trim()) return null;
  const sale = /\b(sale|sell|resale|buy|purchase|outright)\b/.test(text);
  const rent = /\b(rent|rental|lease|tenant)\b/.test(text);
  if (sale && rent) {
    if (/\b(for sale|to sell|resale|buy)\b/.test(text) && !/\bfor rent\b/.test(text)) return 'sale';
    if (/\bfor rent\b/.test(text) && !/\bfor sale\b/.test(text)) return 'rent';
    return null;
  }
  if (sale) return 'sale';
  if (rent) return 'rent';
  return null;
}

export function transactionLabel(value: TransactionSide | null): string {
  if (value === 'rent') return 'Rent';
  if (value === 'sale') return 'Resale';
  return 'Rent or resale';
}

export function extractFloorNumber(raw?: string | null, allowBareNumber = false): number | null {
  const text = (raw || '').trim().toLowerCase();
  if (!text) return null;
  if (/^(g|gr|ground)(?:\s*floor)?$/.test(text)) return 0;
  const labeled = text.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s*(?:floor|flr)\b/)
    || text.match(/\b(?:floor|flr|fl)\.?\s*[:#-]?\s*(\d{1,2})\b/);
  if (labeled) {
    const floor = Number(labeled[1]);
    if (floor >= 0 && floor <= 80) return floor;
  }
  if (!allowBareNumber) return null;
  const bare = text.match(/^(\d{1,2})(?:st|nd|rd|th)?$/);
  if (!bare) return null;
  const floor = Number(bare[1]);
  return floor >= 0 && floor <= 80 ? floor : null;
}

/** Band label only. Never returns the exact floor. */
export function floorRangeLabel(raw?: string | null, allowBareNumber = true): string {
  const floor = extractFloorNumber(raw, allowBareNumber);
  if (floor == null) return 'Floor range on request';
  if (floor <= 0) return 'Ground floor';
  if (floor <= 7) return 'Lower floor 1-7';
  if (floor <= 14) return 'Lower mid floor 8-14';
  if (floor <= 25) return 'Mid floor 15-25';
  if (floor <= 35) return 'Higher floor 26-35';
  if (floor <= 45) return 'High floor 36-45';
  return 'Top floor 46+';
}

export function normPlace(value?: string | null): string {
  return (value || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function placeTokens(value: string): string[] {
  return normPlace(value).split(' ').filter(Boolean);
}

export function placesOverlap(a?: string | null, b?: string | null): boolean {
  const left = normPlace(a);
  const right = normPlace(b);
  if (!left || !right) return false;
  if (left === right) return true;
  const shorter = left.length <= right.length ? left : right;
  const longer = left.length <= right.length ? right : left;
  if (shorter.length >= 6 && longer.includes(shorter)) return true;
  const shared = placeTokens(left).filter((token) => placeTokens(right).includes(token) && !GENERIC_PLACE_TOKENS.has(token));
  if (shared.length >= 2) return true;
  return shared.some((token) => token.length >= 7);
}

export function anyPlaceOverlap(left: Array<string | null | undefined>, right: Array<string | null | undefined>): boolean {
  const a = left.filter((item): item is string => Boolean(item && item.trim()));
  const b = right.filter((item): item is string => Boolean(item && item.trim()));
  if (!a.length || !b.length) return false;
  return a.some((one) => b.some((other) => placesOverlap(one, other)));
}

export function stripSensitiveFragments(value: string): string {
  return value
    .replace(/₹/g, ' ')
    .replace(/\+?\d[\d\s().-]{6,}\d/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function cleanPlaceLabel(value?: string | null): string {
  return stripSensitiveFragments(value || '').replace(/\s+,/g, ',').trim();
}
