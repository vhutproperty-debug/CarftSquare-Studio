import { LISTING_DETECTION_CONFIG } from '@/lib/ops/brokers/config';

type Signal = { key: string; weight: number; pattern: RegExp };

const SIGNALS: Signal[] = [
  { key: 'rent', weight: 2, pattern: /\b(rent|rental|for\s*rent|on\s*rent|lease)\b/i },
  { key: 'sale', weight: 2, pattern: /\b(sale|for\s*sale|resale|selling)\b/i },
  { key: 'available', weight: 1, pattern: /\b(available|availability|immediate|keys?\s*available|vacant)\b/i },
  { key: 'bhk', weight: 2, pattern: /\b\d(?:\.\d)?\s*(bhk|rk)\b/i },
  { key: 'flat', weight: 1, pattern: /\b(flat|apartment|apt|unit|bungalow|villa|penthouse)\b/i },
  { key: 'tower', weight: 1, pattern: /\b(tower|wing|building)\b/i },
  { key: 'furnished', weight: 1, pattern: /\b(furnished|semi[\s-]*furnished|unfurnished)\b/i },
  { key: 'carpet', weight: 1, pattern: /\b(carpet|built[\s-]*up|super\s*built)\b/i },
  { key: 'sqft', weight: 1, pattern: /\b(\d{3,5})\s*(sq\.?\s*ft|sqft|sft)\b/i },
  { key: 'possession', weight: 1, pattern: /\b(possession|ready\s*to\s*move|rtm)\b/i },
  { key: 'price_k', weight: 1, pattern: /\b\d+(?:\.\d+)?\s*k\b/i },
  { key: 'price_lac', weight: 2, pattern: /\b\d+(?:\.\d+)?\s*(lakh|lac|lacs|lakhs)\b/i },
  { key: 'price_cr', weight: 2, pattern: /\b\d+(?:\.\d+)?\s*(cr|crore|crores)\b/i },
  { key: 'deposit', weight: 1, pattern: /\b(deposit|security)\b/i },
  { key: 'parking', weight: 1, pattern: /\b(parking|car\s*park)\b/i },
  { key: 'floor', weight: 1, pattern: /\b(\d{1,2})(st|nd|rd|th)?\s*floor\b/i },
  { key: 'unit_no', weight: 1, pattern: /\b(flat\s*(no\.?|number|#)?\s*\d+|unit\s*(no\.?|#)?\s*\d+)\b/i },
];

export type ListingDetectionResult = {
  isCandidate: boolean;
  score: number;
  matchedSignals: string[];
};

/**
 * Deterministic V1 listing-candidate detector.
 * Modular so LLM extraction can plug in later without changing the import pipeline.
 */
export function detectListingCandidate(rawMessage: string): ListingDetectionResult {
  const text = rawMessage.trim();
  if (!text || text.length < 12) {
    return { isCandidate: false, score: 0, matchedSignals: [] };
  }

  // Skip obvious chatter
  if (/^(ok|okay|yes|no|thanks|thank you|done|hm+|lol|haha)\b/i.test(text) && text.length < 40) {
    return { isCandidate: false, score: 0, matchedSignals: [] };
  }

  const matchedSignals: string[] = [];
  let score = 0;

  for (const signal of SIGNALS) {
    if (signal.pattern.test(text)) {
      matchedSignals.push(signal.key);
      score += signal.weight;
    }
  }

  return {
    isCandidate: score >= LISTING_DETECTION_CONFIG.minSignalScore,
    score,
    matchedSignals,
  };
}
