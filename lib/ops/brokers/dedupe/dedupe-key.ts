import type { ExtractedListingFields } from '@/lib/ops/brokers/types';
import { normalizeKey } from '@/lib/ops/brokers/normalize/project-aliases';

function slug(value?: string | number | null): string {
  if (value == null) return '';
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .trim();
}

/**
 * Conservative deterministic dedupe key.
 *
 * Strong path (unit known):
 *   project + transaction + tower/wing + unit
 *
 * Weak path (no unit):
 *   project + bhk + transaction + broker identity + price/rent + furnishing + floor
 *
 * Avoid merging distinct apartments when unit is missing.
 */
export function buildDedupeKey(input: {
  projectName?: string;
  projectNormalized?: string;
  transactionType: string;
  tower?: string;
  wing?: string;
  unitNumber?: string;
  bhk?: number;
  configuration?: string;
  brokerPhone?: string;
  brokerName?: string;
  rent?: number;
  salePrice?: number;
  furnishing?: string;
  floor?: string;
}): string {
  const project =
    input.projectNormalized ||
    (input.projectName ? normalizeKey(input.projectName) : '') ||
    slug(input.projectName) ||
    'unknownproject';

  const txn = slug(input.transactionType) || 'unknown';
  const unit = slug(input.unitNumber);
  const tower = slug(input.tower);
  const wing = slug(input.wing);
  // Prefer tower as building identity; fall back to wing. Do not require both,
  // or "Tower A flat 1203" vs "Tower A wing 2 flat 1203" would fail to refresh.
  const building = tower || wing;

  if (unit && (project !== 'unknownproject' || building)) {
    return ['u', project, txn, building, unit].join('|');
  }

  const broker = slug(input.brokerPhone) || slug(input.brokerName) || 'unknownbroker';
  const bhk = input.bhk != null ? String(input.bhk) : slug(input.configuration) || 'xbhk';
  const price =
    input.transactionType === 'SALE'
      ? input.salePrice != null
        ? `s${input.salePrice}`
        : 's?'
      : input.rent != null
        ? `r${input.rent}`
        : 'r?';
  const furn = slug(input.furnishing) || 'xfurn';
  const floor = slug(input.floor) || 'xfloor';

  return ['w', project, txn, bhk, broker, price, furn, floor, tower, wing].join('|');
}

export function dedupeKeyFromExtraction(
  extracted: ExtractedListingFields & { projectNormalized?: string },
  broker: { brokerName?: string; brokerPhone?: string },
): string {
  return buildDedupeKey({
    projectName: extracted.projectName,
    projectNormalized: extracted.projectNormalized,
    transactionType: extracted.transactionType,
    tower: extracted.tower,
    wing: extracted.wing,
    unitNumber: extracted.unitNumber,
    bhk: extracted.bhk,
    configuration: extracted.configuration,
    brokerPhone: broker.brokerPhone,
    brokerName: broker.brokerName,
    rent: extracted.rent,
    salePrice: extracted.salePrice,
    furnishing: extracted.furnishing,
    floor: extracted.floor,
  });
}
