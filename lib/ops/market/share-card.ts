/**
 * Broker-facing inventory card.
 * The returned object is the only text that may be copied or drawn.
 * It never includes rent, price, deposit, unit number, exact floor, owner name, owner phone,
 * or commercial terms (brokerage, commission, co-broking, or a split).
 */
import {
  bhkLabel,
  cleanPlaceLabel,
  floorRangeLabel,
  furnishingLabel,
  normalizeBhk,
  normalizeFurnishing,
} from '@/lib/ops/market/normalize';

export const PRICE_LINE = 'Call for price';

export type ShareCardSource = {
  configuration?: string | null;
  bhk?: string | number | null;
  floor?: string | null;
  furnishedStatus?: string | null;
  furnishing?: string | null;
  project?: string | null;
  projectName?: string | null;
  locality?: string | null;
  location?: string | null;
  building?: string | null;
  flatNumber?: string | null;
  unit?: string | null;
  unitNumber?: string | null;
  wing?: string | null;
  ownerName?: string | null;
  name?: string | null;
  ownerMobile?: string | null;
  ownerPhone?: string | null;
  phone?: string | null;
  alternatePhone?: string | null;
  expectedRent?: string | number | null;
  expectedSalePrice?: string | number | null;
  expectedDeposit?: string | number | null;
  rent?: string | number | null;
  salePrice?: string | number | null;
  deposit?: string | number | null;
  brokeragePercent?: string | null;
};

export type BrokerShareCard = {
  bhkLabel: string;
  floorRange: string;
  furnishingLabel: string;
  place: string;
  priceLine: typeof PRICE_LINE;
  lines: string[];
  whatsAppText: string;
};

function publicPlace(source: ShareCardSource): string {
  const project = cleanPlaceLabel(source.project || source.projectName);
  const locality = cleanPlaceLabel(source.locality || source.location);
  const building = cleanPlaceLabel(source.building);
  const primary = project || building;
  if (primary && locality) {
    const primaryKey = primary.toLowerCase();
    const localityKey = locality.toLowerCase();
    if (primaryKey !== localityKey && !primaryKey.includes(localityKey)) {
      return `${primary}, ${locality}`;
    }
  }
  return primary || locality || 'Location on request';
}

export function buildBrokerShareCard(source: ShareCardSource): BrokerShareCard {
  const card: BrokerShareCard = {
    bhkLabel: bhkLabel(normalizeBhk(source.bhk ?? source.configuration)),
    floorRange: floorRangeLabel(source.floor, true),
    furnishingLabel: furnishingLabel(normalizeFurnishing(source.furnishing || source.furnishedStatus)),
    place: publicPlace(source),
    priceLine: PRICE_LINE,
    lines: [],
    whatsAppText: '',
  };
  card.lines = [
    card.bhkLabel,
    card.floorRange,
    card.furnishingLabel,
    card.place,
    card.priceLine,
  ];
  card.whatsAppText = card.lines.join('\n');
  return card;
}
