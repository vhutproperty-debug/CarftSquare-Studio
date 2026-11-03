export type DemandIntent = 'buy' | 'rent' | '';

export type DemandFields = {
  budgetMin: number | null;
  budgetMax: number | null;
  configuration: string;
  location: string;
  possession: string;
  intent: DemandIntent;
};

export type DemandFieldMap = Record<keyof Pick<DemandFields, 'configuration' | 'location' | 'possession'> | 'budget' | 'intent', string[]>;

export const DEFAULT_FIELD_MAP: DemandFieldMap = {
  budget: ['budget', 'budget_range', 'price_range', 'what_is_your_budget', 'price'],
  configuration: ['configuration', 'bhk', 'config', 'bedrooms', 'property_type'],
  location: ['location', 'locality', 'preferred_location', 'area', 'city'],
  possession: ['possession', 'possession_timeline', 'timeline', 'ready_by'],
  intent: ['intent', 'buy_or_rent', 'looking_for', 'purpose', 'i_am_looking_to'],
};

function normalizeKey(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

function scale(raw: string, unit: string): number {
  const amount = Number(raw);
  const name = unit.toLowerCase();
  if (name.startsWith('cr')) return Math.round(amount * 10000000);
  if (name.startsWith('l')) return Math.round(amount * 100000);
  if (name === 'k') return Math.round(amount * 1000);
  return Math.round(amount);
}

export function parseBudget(raw: string): { min: number | null; max: number | null } {
  const text = raw.toLowerCase().replace(/[,₹]/g, '').trim();
  const range = text.match(/(\d+(?:\.\d+)?)\s*(cr|crore|lakh|lac|l|k)?\s*(?:-|–|to)\s*(\d+(?:\.\d+)?)\s*(cr|crore|lakh|lac|l|k)?/i);
  if (range) {
    const unit = range[4] || range[2] || '';
    return { min: scale(range[1], range[2] || unit), max: scale(range[3], range[4] || unit) };
  }
  const single = text.match(/(\d+(?:\.\d+)?)\s*(cr|crore|lakh|lac|l|k)?/i);
  if (!single) return { min: null, max: null };
  const value = scale(single[1], single[2] || '');
  return { min: value, max: value };
}

export function parseIntent(raw: string): DemandIntent {
  const text = raw.toLowerCase();
  if (/rent|lease|tenant/.test(text)) return 'rent';
  if (/buy|sale|purchase|invest/.test(text)) return 'buy';
  return '';
}

export function parseConfiguration(raw: string): string {
  const match = raw.toLowerCase().match(/(\d+)\s*bhk/);
  if (match) return `${match[1]} BHK`;
  const bedrooms = raw.toLowerCase().match(/(\d+)\s*bed/);
  if (bedrooms) return `${bedrooms[1]} BHK`;
  return raw.trim();
}

function answerFor(answers: Record<string, string>, keys: string[]): string {
  const normalized = new Map<string, string>();
  for (const [key, value] of Object.entries(answers)) normalized.set(normalizeKey(key), value);
  for (const key of keys) {
    const value = normalized.get(normalizeKey(key));
    if (value && value.trim()) return value.trim();
  }
  return '';
}

export function mapLeadAnswers(answers: Record<string, string>, fieldMap: DemandFieldMap = DEFAULT_FIELD_MAP): DemandFields {
  const budget = parseBudget(answerFor(answers, fieldMap.budget));
  return {
    budgetMin: budget.min,
    budgetMax: budget.max,
    configuration: parseConfiguration(answerFor(answers, fieldMap.configuration)),
    location: answerFor(answers, fieldMap.location),
    possession: answerFor(answers, fieldMap.possession),
    intent: parseIntent(answerFor(answers, fieldMap.intent)),
  };
}

export type InventoryOffer = {
  id: string;
  name: string;
  locality: string;
  configuration: string;
  possession: string;
  intent: 'buy' | 'rent';
  budgetMin: number | null;
  budgetMax: number | null;
};

function configKey(value: string): string {
  return parseConfiguration(value).toLowerCase();
}

function rangesOverlap(aMin: number | null, aMax: number | null, bMin: number | null, bMax: number | null): boolean {
  if (aMin == null && aMax == null) return true;
  if (bMin == null && bMax == null) return true;
  const left = Math.max(aMin ?? aMax ?? 0, bMin ?? bMax ?? 0);
  const right = Math.min(aMax ?? aMin ?? Number.POSITIVE_INFINITY, bMax ?? bMin ?? Number.POSITIVE_INFINITY);
  return left <= right;
}

function possessionOk(wanted: string, offered: string): boolean {
  if (!wanted || !offered) return true;
  const a = wanted.toLowerCase();
  const b = offered.toLowerCase();
  if (a.includes(b) || b.includes(a)) return true;
  const yearA = a.match(/20\d{2}/);
  const yearB = b.match(/20\d{2}/);
  if (yearA && yearB) return yearA[0] === yearB[0];
  const aReady = /ready|immediate/.test(a);
  const bReady = /ready|immediate/.test(b);
  if (aReady || bReady) return aReady && bReady;
  return false;
}

export function matchInventory(profile: DemandFields, offers: InventoryOffer[]): Array<{ id: string; name: string; reasons: string[] }> {
  const matches: Array<{ id: string; name: string; reasons: string[] }> = [];
  for (const offer of offers) {
    const reasons: string[] = [];
    if (profile.intent && offer.intent !== profile.intent) continue;
    if (profile.intent) reasons.push(`Intent ${profile.intent} matches.`);
    if (profile.configuration && configKey(offer.configuration) !== configKey(profile.configuration)) continue;
    if (profile.configuration) reasons.push(`Configuration ${profile.configuration} matches.`);
    if (profile.location && offer.locality && !offer.locality.toLowerCase().includes(profile.location.toLowerCase()) && !profile.location.toLowerCase().includes(offer.locality.toLowerCase())) {
      continue;
    }
    if (profile.location && offer.locality) reasons.push(`Location ${offer.locality} matches.`);
    if (!rangesOverlap(profile.budgetMin, profile.budgetMax, offer.budgetMin, offer.budgetMax)) continue;
    if (profile.budgetMin != null || profile.budgetMax != null) reasons.push('Budget overlaps.');
    if (!possessionOk(profile.possession, offer.possession)) continue;
    if (profile.possession && offer.possession) reasons.push(`Possession ${offer.possession} matches.`);
    matches.push({ id: offer.id, name: offer.name, reasons });
  }
  return matches;
}
