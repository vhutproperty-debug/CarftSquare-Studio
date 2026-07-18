import { CONFIDENCE_WEIGHTS } from '@/lib/ops/brokers/config';
import type { BrokerConfidenceBreakdown, ExtractedListingFields } from '@/lib/ops/brokers/types';
import type { BrokerMessageParseStatus } from '@/lib/ops/brokers/statuses';

function clamp(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function scoreParserConfidence(input: {
  parseStatus: BrokerMessageParseStatus;
  rawMessageLength: number;
  hasTimestamp: boolean;
  hasSender: boolean;
}): number {
  if (input.parseStatus === 'MALFORMED') return 20;
  if (input.parseStatus === 'SYSTEM' || input.parseStatus === 'SKIPPED') return 10;
  let score = 55;
  if (input.hasTimestamp) score += 20;
  if (input.hasSender) score += 15;
  if (input.rawMessageLength >= 40) score += 10;
  else if (input.rawMessageLength < 20) score -= 15;
  return clamp(score);
}

export function scoreProjectConfidence(input: {
  projectName?: string;
  projectMapped?: boolean;
}): number {
  if (!input.projectName?.trim()) return 15;
  if (input.projectMapped) return 95;
  // Present but unmapped alias
  if (input.projectName.trim().length >= 4) return 45;
  return 25;
}

export function scoreConfigurationConfidence(extracted: ExtractedListingFields): number {
  let score = 20;
  if (extracted.bhk != null || extracted.configuration) score += 45;
  if (extracted.unitNumber) score += 20;
  if (extracted.tower || extracted.wing) score += 10;
  if (extracted.floor) score += 5;
  return clamp(score);
}

export function scorePriceConfidence(extracted: ExtractedListingFields): number {
  const hasRent = extracted.rent != null && extracted.rent > 0;
  const hasSale = extracted.salePrice != null && extracted.salePrice > 0;
  if (extracted.transactionType === 'RENT') {
    if (hasRent && extracted.rentText) return 90;
    if (hasRent) return 70;
    return 25;
  }
  if (extracted.transactionType === 'SALE') {
    if (hasSale && extracted.salePriceText) return 90;
    if (hasSale) return 70;
    return 25;
  }
  if (hasRent || hasSale) return 50;
  return 20;
}

export function scorePhoneConfidence(phone?: string | null): number {
  if (!phone) return 30;
  const digits = phone.replace(/\D/g, '');
  if (/^[6-9]\d{9}$/.test(digits.slice(-10))) return 95;
  if (digits.length >= 10) return 60;
  return 35;
}

export function computeConfidenceBreakdown(input: {
  parseStatus: BrokerMessageParseStatus;
  rawMessage: string;
  hasTimestamp: boolean;
  hasSender: boolean;
  extracted: ExtractedListingFields;
  brokerPhone?: string;
}): BrokerConfidenceBreakdown {
  const parserConfidence = scoreParserConfidence({
    parseStatus: input.parseStatus,
    rawMessageLength: input.rawMessage.trim().length,
    hasTimestamp: input.hasTimestamp,
    hasSender: input.hasSender,
  });
  const projectConfidence = scoreProjectConfidence({
    projectName: input.extracted.projectName,
    projectMapped: input.extracted.projectMapped,
  });
  const configurationConfidence = scoreConfigurationConfidence(input.extracted);
  const priceConfidence = scorePriceConfidence(input.extracted);
  const phoneConfidence = scorePhoneConfidence(input.brokerPhone);

  const overallConfidence = clamp(
    parserConfidence * CONFIDENCE_WEIGHTS.parser
      + projectConfidence * CONFIDENCE_WEIGHTS.project
      + configurationConfidence * CONFIDENCE_WEIGHTS.configuration
      + priceConfidence * CONFIDENCE_WEIGHTS.price
      + phoneConfidence * CONFIDENCE_WEIGHTS.phone,
  );

  return {
    parserConfidence,
    projectConfidence,
    configurationConfidence,
    priceConfidence,
    phoneConfidence,
    overallConfidence,
  };
}

/**
 * How confident we are that an existing inventory row is the same listing.
 * Strong unit keys score high; weak keys score mid/low.
 */
export function scoreDedupeConfidence(input: {
  dedupeKey: string;
  existing: {
    rent?: number;
    salePrice?: number;
    configuration?: string;
    bhk?: number;
    furnishing?: string;
  };
  proposed: {
    rent?: number;
    salePrice?: number;
    configuration?: string;
    bhk?: number;
    furnishing?: string;
  };
}): number {
  let score = input.dedupeKey.startsWith('u|') ? 88 : 55;

  if (
    input.existing.bhk != null
    && input.proposed.bhk != null
    && input.existing.bhk !== input.proposed.bhk
  ) {
    score -= 25;
  }
  if (
    input.existing.configuration
    && input.proposed.configuration
    && input.existing.configuration.toLowerCase() !== input.proposed.configuration.toLowerCase()
  ) {
    score -= 15;
  }

  const er = input.existing.rent;
  const pr = input.proposed.rent;
  if (er != null && pr != null && er > 0) {
    const ratio = Math.abs(er - pr) / er;
    if (ratio > 0.2) score -= 20;
    else if (ratio > 0.05) score -= 8;
  }

  const es = input.existing.salePrice;
  const ps = input.proposed.salePrice;
  if (es != null && ps != null && es > 0) {
    const ratio = Math.abs(es - ps) / es;
    if (ratio > 0.15) score -= 20;
  }

  return clamp(score);
}
