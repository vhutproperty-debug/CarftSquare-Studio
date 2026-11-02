import { createHash } from 'node:crypto';
import { slugify } from '@/lib/ops/projects/format';
import type { ResaleUnitStatus } from '@/lib/ops/projects/types';

export type SplitFlat = {
  tower: string;
  floor: string;
  series: string;
  unitNumber: string;
};

/** Split "B-1406" into tower B, floor 14, series 06. The full flat id stays admin-only. */
export function splitFlat(unit: string, towerHint = ''): SplitFlat {
  const cleaned = unit.trim().replace(/\s+/g, '');
  const match = /^([A-Za-z]+)-(\d+)(?:\/\d+)?$/.exec(cleaned);
  if (!match) {
    const tower = towerHint.trim().toUpperCase();
    return { tower, floor: '', series: '', unitNumber: unit.trim() };
  }
  const tower = match[1].toUpperCase();
  const digits = match[2];
  if (digits.length <= 2) {
    return { tower, floor: '', series: digits.padStart(2, '0'), unitNumber: `${tower}-${digits.padStart(2, '0')}` };
  }
  const series = digits.slice(-2);
  const floor = String(Number(digits.slice(0, -2)));
  return { tower, floor, series, unitNumber: `${tower}-${digits}` };
}

export function floorBandFromFloor(floor: string): string {
  const level = Number(floor);
  if (!Number.isFinite(level) || level <= 0) return '';
  if (level <= 8) return 'Low (1–8)';
  if (level <= 16) return 'Mid-low (9–16)';
  if (level <= 25) return 'Mid (17–25)';
  if (level <= 35) return 'High (26–35)';
  return 'Top (36+)';
}

/**
 * Oberoi Elysian series map.
 * Tower A 01/06 = 4BHK Signature, 02/05 = 3BHK Palatial.
 * Tower B 05/06 = 4BHK Elite.
 */
export function elysianConfig(tower: string, series: string): { bhk: number; configLabel: string } | null {
  const wing = tower.trim().toUpperCase();
  const slot = series.padStart(2, '0');
  if (wing === 'A' && (slot === '01' || slot === '06')) return { bhk: 4, configLabel: '4BHK Signature' };
  if (wing === 'A' && (slot === '02' || slot === '05')) return { bhk: 3, configLabel: '3BHK Palatial' };
  if (wing === 'B' && (slot === '05' || slot === '06')) return { bhk: 4, configLabel: '4BHK Elite' };
  return null;
}

/** Stable slug that does not contain the flat number. The hash is not reversible from the URL. */
export function privateUnitSlug(projectSlug: string, unitNumber: string): string {
  const hash = createHash('sha256').update(`${projectSlug}|${unitNumber.trim().toUpperCase()}`).digest('hex').slice(0, 12);
  return slugify(`${projectSlug}-unit-${hash}`);
}

export function listingTypeForStatus(status: ResaleUnitStatus): 'resale' | 'rental' {
  return status === 'for_rent' || status === 'rented' ? 'rental' : 'resale';
}

export function parseCarpetSqft(text: string): number | null {
  const match = /(\d[\d,]*)\s*carpet/i.exec(text);
  if (!match) return null;
  const value = Number(match[1].replace(/,/g, ''));
  return Number.isFinite(value) ? value : null;
}

export function parseBhk(text: string): number | null {
  const match = /(\d+(?:\.\d+)?)\s*BHK/i.exec(text);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : null;
}

/** First crore figure, so "Ask 2.75 Cr · in-hand 2.70 Cr" keeps 2.75. */
export function firstCrore(text: string): number | null {
  const match = /(\d+(?:\.\d+)?)\s*Cr/i.exec(text);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : null;
}

export function scrubPrivateText(text: string, secrets: string[]): string {
  let out = text || '';
  secrets
    .map((secret) => secret.trim())
    .filter((secret) => secret.length >= 3)
    .sort((a, b) => b.length - a.length)
    .forEach((secret) => {
      out = out.split(secret).join('');
    });
  out = out.replace(/(?:\+?\d[\d\s().-]{8,}\d)/g, '');
  return out.replace(/[ \t]{2,}/g, ' ').replace(/\s+([.,;])/g, '$1').trim();
}
