import { imageFingerprintOverlap } from '@/lib/research/graph/image-fingerprint';
import { slug } from '@/lib/research/graph/identity';
import type { KgProperty } from '@/lib/research/graph/types';
import type { ResearchListing, ResearchScoredListing } from '@/lib/research/types';

export type KgMatchConfidence = {
  score: number;
  reason: string;
  matchingFactors: string[];
};

function attr(listing: ResearchListing | ResearchScoredListing) {
  const scored = listing as ResearchScoredListing;
  const text = `${listing.title || ''} ${listing.rawText || ''}`;
  return {
    project: slug(listing.projectName || listing.title),
    tower: slug(scored.tower || text.match(/\btower\s*([a-z0-9\-]+)/i)?.[1]),
    wing: slug(text.match(/\bwing\s*([a-z0-9\-]+)/i)?.[1]),
    unit: slug(scored.unit || text.match(/\b(?:flat|unit|apt)\s*(?:no\.?|#)?\s*([a-z0-9\-]+)/i)?.[1]),
    carpet: scored.carpetArea != null ? String(scored.carpetArea) : slug(text.match(/(\d{3,4})\s*(?:sq\.?\s*ft|sqft|carpet)/i)?.[1]),
    floor: slug(text.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s*floor\b/i)?.[1]),
    facing: slug(scored.facing || text.match(/\b(west|east|north|south)[-\s]?facing\b/i)?.[1]),
    bhk: listing.bhk != null ? String(listing.bhk) : '',
    broker: slug(scored.broker),
    description: text.replace(/\s+/g, ' ').trim().slice(0, 180).toLowerCase(),
  };
}

/**
 * Explainable identity confidence between a new listing and an existing property.
 * Never invents factors — only observed field overlaps.
 */
export function scoreIdentityMatch(
  listing: ResearchListing | ResearchScoredListing,
  property: KgProperty,
  listingImageFingerprints: string[] = [],
): KgMatchConfidence {
  const a = attr(listing);
  const factors: string[] = [];
  let points = 0;
  let max = 0;

  const check = (label: string, weight: number, ok: boolean) => {
    max += weight;
    if (ok) {
      points += weight;
      factors.push(label);
    }
  };

  check('Project', 25, Boolean(a.project && property.projectName && slug(property.projectName) === a.project));
  check('Tower', 15, Boolean(a.tower && property.tower && slug(property.tower) === a.tower));
  check('Wing', 8, Boolean(a.wing && property.wing && slug(property.wing) === a.wing));
  check('Unit', 25, Boolean(a.unit && property.unit && slug(property.unit) === a.unit));
  check('Configuration', 8, Boolean(a.bhk && property.bhk != null && String(property.bhk) === a.bhk));
  check('Carpet Area', 10, Boolean(a.carpet && property.carpetArea != null && String(property.carpetArea) === a.carpet));
  check('Floor', 6, Boolean(a.floor && property.floor && slug(property.floor) === a.floor));
  check('Facing', 5, Boolean(a.facing && property.facing && slug(property.facing) === a.facing));
  check('Broker', 4, Boolean(a.broker && property.brokerHistory.some((b) => slug(b.brokerName) === a.broker)));

  const propertyImages = [
    ...(property.imageFingerprints || []),
    ...(property.imageHashes || []),
  ];
  const img = imageFingerprintOverlap(listingImageFingerprints, propertyImages);
  max += 12;
  if (img.shared.length) {
    points += Math.round(12 * Math.min(1, img.score + 0.4));
    factors.push('Image Hash');
  }

  if (a.description && property.title) {
    max += 6;
    const descOverlap =
      a.description.includes(property.title.toLowerCase().slice(0, 20))
      || property.title.toLowerCase().includes(a.description.slice(0, 20));
    if (descOverlap) {
      points += 6;
      factors.push('Description');
    }
  }

  const score = max > 0 ? Math.round((points / max) * 100) : 0;
  const reason =
    factors.length > 0
      ? `Matched by ${factors.join(', ')}`
      : 'Insufficient overlapping fields for a confident match';

  return { score, reason, matchingFactors: factors };
}

export function isConfidentMatch(confidence: KgMatchConfidence): boolean {
  // Require strong unit/project or high overall score with multiple factors
  if (confidence.matchingFactors.includes('Unit') && confidence.matchingFactors.includes('Project')) {
    return confidence.score >= 70;
  }
  return confidence.score >= 85 && confidence.matchingFactors.length >= 3;
}
