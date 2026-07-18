import {
  normalizeFurnishing,
  normalizeTransactionType,
  parseAreaSqft,
  parseBhk,
  parseMoneyToInr,
} from '@/lib/ops/brokers/normalize/normalize';
import { titleCaseWords } from '@/lib/ops/brokers/normalize/normalize';
import type { ExtractedListingFields } from '@/lib/ops/brokers/types';

/**
 * Deterministic field extraction from a listing-candidate WhatsApp message.
 * Preserves original money/area text snippets for audit.
 */
export function extractListingFields(rawMessage: string): ExtractedListingFields {
  const text = rawMessage.replace(/\r/g, '');
  const transactionType = normalizeTransactionType(text);
  const furnishing = normalizeFurnishing(text);
  const bhkInfo = parseBhk(text);

  const rentMatch = text.match(
    /(?:rent|rental|lease)\s*(?:is|:|-)?\s*(?:rs\.?|₹)?\s*([0-9.,]+\s*(?:k|lakh|lac|lacs|lakhs)?)/i,
  ) || text.match(/(?:rs\.?|₹)\s*([0-9.,]+\s*k)\b/i);

  const saleMatch = text.match(
    /(?:sale|price|asking)\s*(?:is|:|-)?\s*(?:rs\.?|₹)?\s*([0-9.,]+\s*(?:cr|crore|crores|lakh|lac|lacs|lakhs))/i,
  ) || text.match(/\b([0-9.,]+\s*(?:cr|crore|crores))\b/i);

  const depositMatch = text.match(
    /(?:deposit|security)\s*(?:is|:|-)?\s*(?:rs\.?|₹)?\s*([0-9.,]+\s*(?:k|lakh|lac|lacs|lakhs)?)/i,
  );

  const areaMatch = text.match(
    /(?:carpet|built[\s-]*up|super\s*built)?\s*(?:area)?\s*(?:is|:|-)?\s*([0-9.,]+\s*(?:sq\.?\s*ft|sqft|sft))/i,
  );

  const towerMatch = text.match(/\b(?:tower|t)\s*[-:]?\s*([A-Za-z0-9]+)\b/i);
  const wingMatch = text.match(/\bwing\s*[-:]?\s*([A-Za-z0-9]+)\b/i);
  const unitMatch =
    text.match(/\b(?:flat|unit|apt)\s*(?:no\.?|number|#)?\s*[-:]?\s*([A-Za-z0-9\-]+)\b/i) ||
    text.match(/#\s*([A-Za-z0-9\-]+)\b/);
  const floorMatch = text.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s*floor\b/i);
  const parkingMatch = text.match(/\b(\d+\s*)?(covered|open)?\s*parking\b/i);
  const availabilityMatch = text.match(
    /\b(immediate|immediately|available\s*(from|now)?[^\n,]{0,40}|keys?\s*available|vacant)\b/i,
  );

  // Project: look for known patterns after "in" / "at" / project labels
  let projectName: string | undefined;
  const projectLabeled = text.match(
    /\b(?:project|society|in|at)\s*[:\-]?\s*([A-Za-z][A-Za-z0-9 &\-]{2,60})/i,
  );
  if (projectLabeled) {
    projectName = titleCaseWords(projectLabeled[1].split(/[,\n|]/)[0]);
  }
  if (!projectName) {
    // Fallback: first line often has project (alias mapping happens in normalize step)
    const firstLine = text.split('\n')[0]?.trim();
    if (firstLine && firstLine.length < 80 && !/^\d/.test(firstLine)) {
      const candidate = titleCaseWords(firstLine.replace(/[:\-–].*$/, '').trim());
      if (candidate && !/\b(rent|sale|available|bhk)\b/i.test(candidate)) {
        projectName = candidate;
      }
    }
  }

  const rentText = rentMatch?.[1]?.trim();
  const salePriceText = saleMatch?.[1]?.trim();
  const depositText = depositMatch?.[1]?.trim();
  const areaText = areaMatch?.[1]?.trim();

  let rent = rentText ? parseMoneyToInr(rentText) : undefined;
  let salePrice = salePriceText ? parseMoneyToInr(salePriceText) : undefined;

  // If transaction is RENT and we only found a "k" amount without label, use it as rent
  if (transactionType === 'RENT' && rent == null) {
    const kOnly = text.match(/\b(\d{2,3})\s*k\b/i);
    if (kOnly) {
      rent = parseMoneyToInr(`${kOnly[1]}k`);
    }
  }

  if (transactionType === 'SALE' && salePrice == null && salePriceText == null) {
    const crOnly = text.match(/\b(\d+(?:\.\d+)?)\s*(cr|crore)\b/i);
    if (crOnly) salePrice = parseMoneyToInr(crOnly[0]);
  }

  const propertyType = /\b(villa|bungalow)\b/i.test(text)
    ? 'villa'
    : /\b(penthouse)\b/i.test(text)
      ? 'penthouse'
      : /\b(shop|office|commercial)\b/i.test(text)
        ? 'commercial'
        : /\b(flat|apartment|apt|bhk)\b/i.test(text)
          ? 'apartment'
          : undefined;

  return {
    projectName,
    tower: towerMatch?.[1],
    wing: wingMatch?.[1],
    unitNumber: unitMatch?.[1],
    configuration: bhkInfo.configuration,
    bhk: bhkInfo.bhk,
    transactionType,
    propertyType,
    carpetArea: areaText ? parseAreaSqft(areaText) : undefined,
    rent,
    salePrice,
    deposit: depositText ? parseMoneyToInr(depositText) : undefined,
    furnishing,
    parking: parkingMatch?.[0],
    availability: availabilityMatch?.[0],
    floor: floorMatch ? `${floorMatch[1]}` : undefined,
    notes: undefined,
    rentText,
    salePriceText,
    depositText,
    areaText,
    configurationText: bhkInfo.configuration,
  };
}
