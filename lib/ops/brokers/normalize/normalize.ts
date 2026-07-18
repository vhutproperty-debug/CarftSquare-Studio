import { normalizeIndianMobile } from '@/lib/phone/indian-mobile';
import {
  normalizeKey,
  normalizeProjectNameWithMap,
} from '@/lib/ops/brokers/normalize/project-aliases';
import type { BrokerFurnishing, BrokerTransactionType } from '@/lib/ops/brokers/statuses';
import type { ExtractedListingFields } from '@/lib/ops/brokers/types';

export function normalizePhone(value?: string | null): string | undefined {
  if (!value?.trim()) return undefined;
  const mobile = normalizeIndianMobile(value);
  return mobile.length === 10 ? mobile : undefined;
}

export function normalizeTransactionType(text: string): BrokerTransactionType {
  const t = text.toLowerCase();
  const rentSignals = /\b(rent|rental|lease|pg|on\s*rent|for\s*rent|monthly)\b/.test(t);
  const saleSignals = /\b(sale|sell|selling|resale|for\s*sale|buy|purchase)\b/.test(t);
  if (rentSignals && !saleSignals) return 'RENT';
  if (saleSignals && !rentSignals) return 'SALE';
  if (saleSignals && rentSignals) {
    // Prefer explicit "for sale" / "for rent"
    if (/\bfor\s*sale\b/.test(t) && !/\bfor\s*rent\b/.test(t)) return 'SALE';
    if (/\bfor\s*rent\b/.test(t) && !/\bfor\s*sale\b/.test(t)) return 'RENT';
  }
  return 'UNKNOWN';
}

export function normalizeFurnishing(text: string): BrokerFurnishing {
  const t = text.toLowerCase();
  if (/\b(semi[\s-]*furnished|semi\s*furnish)\b/.test(t)) return 'SEMI_FURNISHED';
  if (/\b(unfurnished|un[\s-]*furnished|bare)\b/.test(t)) return 'UNFURNISHED';
  if (/\b(fully\s*furnished|furnished|full\s*furnish)\b/.test(t)) return 'FURNISHED';
  return 'UNKNOWN';
}

/** Parse Indian rent/price shorthand into absolute INR number. */
export function parseMoneyToInr(raw?: string | null): number | undefined {
  if (!raw?.trim()) return undefined;
  const text = raw.toLowerCase().replace(/,/g, '').trim();

  // 3.5 cr / 3.5 crore
  const cr = text.match(/(\d+(?:\.\d+)?)\s*(cr|crore|crores)\b/);
  if (cr) {
    const n = Number(cr[1]) * 10_000_000;
    return Number.isFinite(n) ? Math.round(n) : undefined;
  }

  // 85 lac / 85 lakh / 85 lacs
  const lac = text.match(/(\d+(?:\.\d+)?)\s*(lakh|lac|lacs|lakhs)\b/);
  if (lac) {
    const n = Number(lac[1]) * 100_000;
    return Number.isFinite(n) ? Math.round(n) : undefined;
  }

  // 85k / 85 K
  const k = text.match(/(\d+(?:\.\d+)?)\s*k\b/);
  if (k) {
    const n = Number(k[1]) * 1000;
    return Number.isFinite(n) ? Math.round(n) : undefined;
  }

  // Plain number
  const plain = text.match(/(\d+(?:\.\d+)?)/);
  if (plain) {
    const n = Number(plain[1]);
    return Number.isFinite(n) ? Math.round(n) : undefined;
  }

  return undefined;
}

export function parseAreaSqft(raw?: string | null): number | undefined {
  if (!raw?.trim()) return undefined;
  const m = raw.toLowerCase().replace(/,/g, '').match(/(\d+(?:\.\d+)?)\s*(sq\.?\s*ft|sqft|sft)?/);
  if (!m) return undefined;
  const n = Number(m[1]);
  return Number.isFinite(n) ? Math.round(n) : undefined;
}

export function parseBhk(raw?: string | null): { configuration?: string; bhk?: number } {
  if (!raw?.trim()) return {};
  const text = raw.toLowerCase();
  const match = text.match(/(\d(?:\.\d)?)\s*(?:bhk|rk)/i) || text.match(/\b(\d)\s*bhk\b/i);
  if (!match) return {};
  const bhk = Number(match[1]);
  if (!Number.isFinite(bhk)) return {};
  const isRk = /rk/.test(text);
  return {
    bhk: Math.floor(bhk),
    configuration: isRk ? `${bhk} RK` : `${bhk} BHK`,
  };
}

export function titleCaseWords(value?: string | null): string | undefined {
  if (!value?.trim()) return undefined;
  return value
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

export function normalizeExtractedListing(
  extracted: ExtractedListingFields,
  messageText: string,
  aliasMap?: Map<string, string>,
): ExtractedListingFields {
  const project = aliasMap
    ? normalizeProjectNameWithMap(extracted.projectName, aliasMap)
    : {
        projectName: extracted.projectName
          ? titleCaseWords(extracted.projectName) || extracted.projectName
          : undefined,
        projectNormalized: extracted.projectName
          ? normalizeKey(extracted.projectName)
          : undefined,
        projectMapped: false,
      };
  const bhkInfo = parseBhk(extracted.configurationText || extracted.configuration || messageText);

  return {
    ...extracted,
    projectName: project.projectName || extracted.projectName,
    projectNormalized: project.projectNormalized,
    projectMapped: project.projectMapped,
    configuration: extracted.configuration || bhkInfo.configuration,
    bhk: extracted.bhk ?? bhkInfo.bhk,
    transactionType:
      extracted.transactionType !== 'UNKNOWN'
        ? extracted.transactionType
        : normalizeTransactionType(messageText),
    furnishing:
      extracted.furnishing !== 'UNKNOWN'
        ? extracted.furnishing
        : normalizeFurnishing(messageText),
    rent: extracted.rent ?? parseMoneyToInr(extracted.rentText),
    salePrice: extracted.salePrice ?? parseMoneyToInr(extracted.salePriceText),
    deposit: extracted.deposit ?? parseMoneyToInr(extracted.depositText),
    carpetArea: extracted.carpetArea ?? parseAreaSqft(extracted.areaText),
    tower: titleCaseWords(extracted.tower) || extracted.tower,
    wing: titleCaseWords(extracted.wing) || extracted.wing,
    unitNumber: extracted.unitNumber?.trim() || undefined,
    parking: extracted.parking?.trim() || undefined,
    availability: extracted.availability?.trim() || undefined,
    floor: extracted.floor?.trim() || undefined,
  };
}
