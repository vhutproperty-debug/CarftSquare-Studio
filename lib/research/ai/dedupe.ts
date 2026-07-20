import type { ResearchListing, ResearchScoredListing } from '@/lib/research/types';

function slug(value?: string | number | null): string {
  if (value == null) return '';
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .trim();
}

function priceBucket(n?: number): string {
  if (n == null || !Number.isFinite(n)) return '';
  return String(Math.round(n / 1000) * 1000);
}

function extractField(listing: ResearchListing, key: string): string {
  const extracted = listing.extracted || {};
  const v = extracted[key];
  return v == null ? '' : String(v);
}

/** Deterministic cross-portal property fingerprint. */
export function listingFingerprint(listing: ResearchListing): string {
  const project = slug(listing.projectName || listing.title);
  const tower = slug(extractField(listing, 'tower') || listing.extracted?.tower as string);
  const unit = slug(extractField(listing, 'unit') || listing.extracted?.unit as string);
  const carpet = slug(
    extractField(listing, 'carpetArea')
    || listing.extracted?.carpetArea as string
    || listing.extracted?.carpet as string,
  );
  const price = priceBucket(listing.rent ?? listing.salePrice);
  const broker = slug(extractField(listing, 'broker') || listing.extracted?.broker as string);
  const url = slug(listing.url);

  if (unit && (project || tower)) {
    return ['u', project, tower, unit, price].join('|');
  }
  if (project && carpet && price) {
    return ['c', project, carpet, price, listing.bhk || ''].join('|');
  }
  if (project && price && listing.bhk != null) {
    return ['p', project, String(listing.bhk), price, broker].join('|');
  }
  if (url) return ['url', url].join('|');
  return ['id', listing.id].join('|');
}

/**
 * Merge identical properties across portals. Keeps all portal references.
 */
export function dedupeAcrossPortals(listings: ResearchListing[]): {
  unique: ResearchScoredListing[];
  duplicatesRemoved: number;
} {
  const groups = new Map<string, ResearchListing[]>();
  for (const listing of listings) {
    const key = listingFingerprint(listing);
    const arr = groups.get(key) || [];
    arr.push(listing);
    groups.set(key, arr);
  }

  const unique: ResearchScoredListing[] = [];
  let duplicatesRemoved = 0;

  for (const [groupId, group] of groups) {
    duplicatesRemoved += Math.max(0, group.length - 1);
    const primary = pickPrimary(group);
    const portalRefs = group.map((g) => ({
      portal: g.portal,
      url: g.url,
      listingId: g.id,
    }));
    unique.push({
      ...enrichListing(primary),
      duplicateGroupId: groupId,
      portalRefs,
      relevanceScore: 0,
      scoreBreakdown: {},
      explanation: '',
    });
  }

  return { unique, duplicatesRemoved };
}

function pickPrimary(group: ResearchListing[]): ResearchListing {
  return [...group].sort((a, b) => {
    const aScore = (a.title ? 1 : 0) + (a.rent || a.salePrice ? 1 : 0) + (a.url ? 1 : 0);
    const bScore = (b.title ? 1 : 0) + (b.rent || b.salePrice ? 1 : 0) + (b.url ? 1 : 0);
    return bScore - aScore;
  })[0]!;
}

function enrichListing(listing: ResearchListing): ResearchListing & {
  carpetArea?: number;
  tower?: string;
  unit?: string;
  broker?: string;
  parking?: string;
  amenities?: string[];
  facing?: string;
  listingSource?: 'owner' | 'broker' | 'unknown';
  listedBy?: 'owner' | 'broker' | 'builder' | 'unknown';
  rentPerSqft?: number;
} {
  const text = `${listing.title || ''} ${listing.rawText || ''}`.toLowerCase();
  const carpetMatch = text.match(/(\d{3,4})\s*(?:sq\.?\s*ft|sqft|carpet)/i);
  const carpetArea = carpetMatch ? Number(carpetMatch[1]) : undefined;
  const price = listing.rent ?? listing.salePrice;
  const facingMatch = text.match(/\b(west|east|north|south)[-\s]?facing\b/i);
  const listedBy =
    listing.listedBy
    || (/\bowner\b/.test(text)
      ? 'owner'
      : /\bbroker\b|\bagent\b|\bdealer\b/.test(text)
        ? 'broker'
        : /\bbuilder\b/.test(text)
          ? 'builder'
          : 'unknown');
  const listingSource: 'owner' | 'broker' | 'unknown' =
    listedBy === 'owner' ? 'owner' : listedBy === 'broker' ? 'broker' : 'unknown';
  return {
    ...listing,
    carpetArea,
    rentPerSqft:
      carpetArea && price && carpetArea > 0
        ? Math.round((price / carpetArea) * 10) / 10
        : undefined,
    tower: (listing.extracted?.tower as string) || undefined,
    unit: (listing.extracted?.unit as string) || undefined,
    broker: (listing.extracted?.broker as string) || undefined,
    parking: /\bparking\b/.test(text) ? 'mentioned' : undefined,
    amenities: [],
    facing: facingMatch ? facingMatch[1].toLowerCase() : undefined,
    listedBy,
    listingSource,
  };
}
