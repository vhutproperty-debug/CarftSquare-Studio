import {
  CHANNEL_PARTNER_STATUSES,
  DEVELOPER_STATUSES,
  LISTING_TYPES,
  PRICE_BANDS,
  RESALE_UNIT_STATUSES,
  type ChannelPartnerStatus,
  type DeveloperProjectStatus,
  type PriceBandId,
  type ResaleListingType,
  type ResaleUnitStatus,
} from '@/lib/ops/projects/types';

const RESERVED_SLUGS = new Set(['units', 'new', 'developer', 'resale', 'api', 'uploads']);

export function slugify(value: string): string {
  const slug = value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/g, '');
  if (!slug) return '';
  return RESERVED_SLUGS.has(slug) ? `${slug}-project` : slug;
}

export function parseBhks(text: string): number[] {
  const values = new Set<number>();
  const pattern = /((?:\d+(?:\.\d+)?\s*(?:,|&|and)?\s*)+)\s*BHK/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text))) {
    const nums = match[1].match(/\d+(?:\.\d+)?/g) || [];
    nums.forEach((num) => {
      const value = Number(num);
      if (Number.isFinite(value)) values.add(value);
    });
  }
  return [...values].sort((a, b) => a - b);
}

function croreValues(text: string): number[] {
  const values: number[] = [];
  const range = /(\d+(?:\.\d+)?)\s*[\u2012\u2013\u2014-]\s*(\d+(?:\.\d+)?)\s*Cr/gi;
  const single = /(\d+(?:\.\d+)?)\s*Cr/gi;
  let match: RegExpExecArray | null;
  while ((match = range.exec(text))) {
    values.push(Number(match[1]), Number(match[2]));
  }
  while ((match = single.exec(text))) values.push(Number(match[1]));
  return values.filter((value) => Number.isFinite(value));
}

export function parseCrores(text: string): { min: number | null; max: number | null } {
  const values = croreValues(text);
  if (!values.length) return { min: null, max: null };
  return { min: Math.min(...values), max: Math.max(...values) };
}

function numeric(value: string): number {
  return Number(value.replace(/,/g, ''));
}

export function parsePsf(text: string): { min: number | null; max: number | null } {
  const values: number[] = [];
  const pattern = /₹?\s*(\d[\d,]*)\s*(?:[\u2012\u2013\u2014-]\s*₹?\s*(\d[\d,]*)\s*)?\/\s*sq/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text))) {
    values.push(numeric(match[1]));
    if (match[2]) values.push(numeric(match[2]));
  }
  const finite = values.filter((value) => Number.isFinite(value) && value > 0);
  if (!finite.length) return { min: null, max: null };
  return { min: Math.min(...finite), max: Math.max(...finite) };
}

export function parseCarpet(text: string): { min: number | null; max: number | null } {
  const values: number[] = [];
  const range = /(\d[\d,]*(?:\.\d+)?)\s*[\u2012\u2013\u2014-]\s*(\d[\d,]*(?:\.\d+)?)\s*sq/gi;
  const single = /(\d[\d,]*(?:\.\d+)?)\s*sq/gi;
  let match: RegExpExecArray | null;
  while ((match = range.exec(text))) {
    values.push(numeric(match[1]), numeric(match[2]));
  }
  while ((match = single.exec(text))) values.push(numeric(match[1]));
  const finite = values.filter((value) => Number.isFinite(value) && value > 0);
  if (!finite.length) return { min: null, max: null };
  return { min: Math.min(...finite), max: Math.max(...finite) };
}

export function normalizeDeveloperStatus(label: string): DeveloperProjectStatus {
  const value = label.toLowerCase();
  if (value.includes('sold out') || value.includes('sold-out')) return 'sold_out';
  if (value.includes('under construction')) return 'under_construction';
  if (value.includes('ready')) return 'ready';
  if (value.includes('launch') || value.includes('registered') || value.includes('new')) return 'new_launch';
  return 'other';
}

export function isDeveloperStatus(value: string): value is DeveloperProjectStatus {
  return (DEVELOPER_STATUSES as readonly string[]).includes(value);
}

export function isChannelPartnerStatus(value: string): value is ChannelPartnerStatus {
  return (CHANNEL_PARTNER_STATUSES as readonly string[]).includes(value);
}

export function isResaleUnitStatus(value: string): value is ResaleUnitStatus {
  return (RESALE_UNIT_STATUSES as readonly string[]).includes(value);
}

export function normalizeResaleStatus(value: string): ResaleUnitStatus | null {
  const key = value.trim().toLowerCase().replace(/[\s-]+/g, '_');
  const mapped: Record<string, ResaleUnitStatus> = {
    for_sale: 'for_sale',
    sale: 'for_sale',
    selling: 'for_sale',
    for_rent: 'for_rent',
    rent: 'for_rent',
    rental: 'for_rent',
    available: 'available',
    follow_up: 'follow_up',
    followup: 'follow_up',
    under_offer: 'under_offer',
    sold: 'sold',
    rented: 'rented',
  };
  return mapped[key] || (isResaleUnitStatus(key) ? key : null);
}

export function isListingType(value: string): value is ResaleListingType {
  return (LISTING_TYPES as readonly string[]).includes(value);
}

export function isPriceBand(value: string): value is PriceBandId {
  return value === '' || PRICE_BANDS.some((band) => band.id === value);
}

export function overlapsPriceBand(
  min: number | null,
  max: number | null,
  bandId: PriceBandId,
): boolean {
  if (!bandId) return true;
  const band = PRICE_BANDS.find((item) => item.id === bandId);
  if (!band) return true;
  const low = min ?? max;
  const high = max ?? min;
  if (low == null || high == null) return false;
  return high >= band.min && low < band.max;
}

export function formatInr(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return `₹${Math.round(value).toLocaleString('en-IN')}`;
}

export function formatPsf(min: number | null, max: number | null): string {
  if (min == null && max == null) return '—';
  if (min != null && max != null && min !== max) return `${formatInr(min)}–${formatInr(max)}/sqft`;
  return `${formatInr(min ?? max)}/sqft`;
}

export function formatCrore(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  const rounded = Number.isInteger(value) ? String(value) : String(Math.round(value * 100) / 100);
  return `₹${rounded} Cr`;
}

export function formatCarpet(min: number | null, max: number | null): string {
  if (min == null && max == null) return '—';
  const left = min ?? max;
  const right = max ?? min;
  if (left == null) return '—';
  if (right != null && right !== left) {
    return `${Math.round(left).toLocaleString('en-IN')}–${Math.round(right).toLocaleString('en-IN')} sq ft`;
  }
  return `${Math.round(left).toLocaleString('en-IN')} sq ft`;
}

export function formatWhen(iso: string): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function safeAssetUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('/uploads/') && !trimmed.includes('..') && !trimmed.includes('\\')) return trimmed;
  try {
    const url = new URL(trimmed);
    if (url.protocol === 'https:' || url.protocol === 'http:') return url.toString();
  } catch {
    return null;
  }
  return null;
}

export function splitSourceLinks(value: string): string[] {
  return value
    .split(/[;\n]/)
    .map((part) => part.match(/https?:\/\/[^\s)]+/i)?.[0] || '')
    .map((url) => url.replace(/[.,]+$/, ''))
    .filter(Boolean);
}

export function linesOf(value: string): string[] {
  return value.split(/\n/).map((line) => line.trim()).filter(Boolean);
}

export function matchesBhk(bhks: number[], selected: string): boolean {
  if (!selected) return true;
  const target = Number(selected);
  if (!Number.isFinite(target)) return true;
  return bhks.some((bhk) => bhk === target);
}
