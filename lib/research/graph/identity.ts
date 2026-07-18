import type { ResearchListing, ResearchScoredListing } from '@/lib/research/types';

export function slug(value?: string | number | null): string {
  if (value == null) return '';
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .trim();
}

function extract(listing: ResearchListing, key: string): string {
  const v = listing.extracted?.[key];
  if (v != null) return String(v);
  const scored = listing as ResearchScoredListing;
  if (key === 'tower' && scored.tower) return scored.tower;
  if (key === 'unit' && scored.unit) return scored.unit;
  if (key === 'broker' && scored.broker) return scored.broker;
  if (key === 'facing' && scored.facing) return scored.facing;
  if (key === 'carpetArea' && scored.carpetArea != null) return String(scored.carpetArea);
  return '';
}

function parseFromText(listing: ResearchListing) {
  const text = `${listing.title || ''} ${listing.rawText || ''}`;
  const tower =
    extract(listing, 'tower')
    || text.match(/\btower\s*([a-z0-9\-]+)/i)?.[1]
    || '';
  const wing =
    extract(listing, 'wing')
    || text.match(/\bwing\s*([a-z0-9\-]+)/i)?.[1]
    || '';
  const unit =
    extract(listing, 'unit')
    || text.match(/\b(?:flat|unit|apt)\s*(?:no\.?|#)?\s*([a-z0-9\-]+)/i)?.[1]
    || '';
  const floor =
    extract(listing, 'floor')
    || text.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s*floor\b/i)?.[1]
    || '';
  const carpet =
    extract(listing, 'carpetArea')
    || text.match(/(\d{3,4})\s*(?:sq\.?\s*ft|sqft|carpet)/i)?.[1]
    || '';
  const facing =
    extract(listing, 'facing')
    || text.match(/\b(west|east|north|south)[-\s]?facing\b/i)?.[1]
    || '';
  return {
    tower: slug(tower),
    wing: slug(wing),
    unit: slug(unit),
    floor: slug(floor),
    carpet: slug(carpet),
    facing: slug(facing),
    broker: slug(extract(listing, 'broker') || (listing as ResearchScoredListing).broker),
    project: slug(listing.projectName || listing.title),
    bhk: listing.bhk != null ? String(listing.bhk) : '',
    url: slug(listing.url),
  };
}

/**
 * Deterministic identity fingerprints for a listing observation.
 * Primary fingerprint prefers unit/tower identity; alts support rematch.
 */
export function buildIdentityFingerprints(listing: ResearchListing): {
  fingerprint: string;
  altFingerprints: string[];
} {
  const f = parseFromText(listing);
  const alts: string[] = [];

  let fingerprint = '';
  if (f.unit && (f.project || f.tower)) {
    fingerprint = ['unit', f.project, f.tower, f.wing, f.unit, f.bhk].join('|');
  } else if (f.project && f.carpet && f.bhk && f.floor) {
    fingerprint = ['carpet-floor', f.project, f.carpet, f.floor, f.bhk, f.facing].join('|');
  } else if (f.project && f.carpet && f.bhk) {
    fingerprint = ['carpet', f.project, f.carpet, f.bhk, f.facing].join('|');
  } else if (f.url) {
    fingerprint = ['url', f.url].join('|');
  } else {
    fingerprint = ['weak', f.project, f.bhk, f.broker, slug(listing.title).slice(0, 40)].join('|');
  }

  if (f.project && f.unit) {
    alts.push(['unit-loose', f.project, f.unit, f.bhk].join('|'));
  }
  if (f.project && f.carpet && f.bhk) {
    alts.push(['carpet-loose', f.project, f.carpet, f.bhk].join('|'));
  }
  if (f.url) alts.push(['url', f.url].join('|'));

  return {
    fingerprint,
    altFingerprints: Array.from(new Set(alts.filter((a) => a && a !== fingerprint))),
  };
}

export function listingAttributes(listing: ResearchListing | ResearchScoredListing) {
  const f = parseFromText(listing);
  const scored = listing as ResearchScoredListing;
  const text = `${listing.title || ''} ${listing.rawText || ''}`;
  return {
    projectName: listing.projectName || undefined,
    tower: scored.tower || (f.tower ? f.tower : undefined),
    wing: f.wing || undefined,
    unit: scored.unit || (f.unit ? f.unit : undefined),
    floor: f.floor || undefined,
    facing: scored.facing || (f.facing ? f.facing : undefined),
    carpetArea: scored.carpetArea
      || (f.carpet ? Number(f.carpet) : undefined),
    brokerName: scored.broker || extract(listing, 'broker') || undefined,
    descriptionSnippet: text.replace(/\s+/g, ' ').trim().slice(0, 400) || undefined,
    imageHashes: Array.isArray(listing.extracted?.imageHashes)
      ? (listing.extracted!.imageHashes as string[])
      : [],
  };
}
