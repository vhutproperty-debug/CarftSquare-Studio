import type { AssistantSearchState } from '@/lib/ops/brokers/assistant/types';

function parseMoneyToken(raw: string, unit?: string): number | undefined {
  const n = Number(raw.replace(/,/g, ''));
  if (!Number.isFinite(n)) return undefined;
  const u = (unit || '').toLowerCase();
  if (u === 'k' || u === 'K') return Math.round(n * 1000);
  if (u.startsWith('l')) return Math.round(n * 100_000);
  if (u.startsWith('cr')) return Math.round(n * 10_000_000);
  // Bare small numbers often mean thousands in Mumbai rental speech (e.g. "65" → ambiguous).
  // Prefer explicit k/lakh; if value looks like thousands already (>=1000) keep as-is.
  if (n > 0 && n < 500 && !u) return Math.round(n * 1000);
  return Math.round(n);
}

function extractQuoted(text: string): { keyword?: string; rest: string } {
  const m = text.match(/['"]([^'"]{2,80})['"]/);
  if (!m) return { rest: text };
  return {
    keyword: m[1].trim(),
    rest: `${text.slice(0, m.index)} ${text.slice((m.index || 0) + m[0].length)}`.replace(/\s+/g, ' ').trim(),
  };
}

/**
 * Deterministic Phase-1 NL → structured search.
 * Returns a partial state delta to merge onto the conversation state.
 */
export function parseNaturalLanguageQuery(
  input: string,
  knownProjects: string[] = [],
): { delta: Partial<AssistantSearchState>; interpretedAs: string[]; reset?: boolean } {
  const interpretedAs: string[] = [];
  const delta: Partial<AssistantSearchState> = {};
  let text = input.trim();
  if (!text) return { delta, interpretedAs };

  const lower = text.toLowerCase();

  if (/^(clear|reset|start over|new search)\b/.test(lower)) {
    return { delta: {}, interpretedAs: ['Cleared previous filters'], reset: true };
  }

  const quoted = extractQuoted(text);
  if (quoted.keyword) {
    delta.messageKeyword = quoted.keyword;
    interpretedAs.push(`WhatsApp keyword: “${quoted.keyword}”`);
    text = quoted.rest;
  }

  // Transaction
  if (/\b(rentals?|for rent|on rent|rental)\b/i.test(text)) {
    delta.transactionType = 'RENT';
    interpretedAs.push('Type: Rent');
  } else if (/\b(sale|for sale|resale|selling)\b/i.test(text)) {
    delta.transactionType = 'SALE';
    interpretedAs.push('Type: Sale');
  }

  // BHK
  const bhkMatch = text.match(/\b(\d(?:\.\d)?)\s*bhk\b/i);
  if (bhkMatch) {
    delta.bhk = String(Number(bhkMatch[1]));
    interpretedAs.push(`Configuration: ${delta.bhk} BHK`);
    text = text.replace(bhkMatch[0], ' ');
  }

  // Furnishing
  if (/\bsemi[-\s]?furnished\b/i.test(text)) {
    delta.furnishing = 'SEMI_FURNISHED';
    interpretedAs.push('Furnishing: Semi-furnished');
    text = text.replace(/\bsemi[-\s]?furnished\b/gi, ' ');
  } else if (/\b(fully\s+)?furnished\b/i.test(text)) {
    delta.furnishing = 'FURNISHED';
    interpretedAs.push('Furnishing: Furnished');
    text = text.replace(/\b(fully\s+)?furnished\b/gi, ' ');
  } else if (/\bunfurnished\b/i.test(text)) {
    delta.furnishing = 'UNFURNISHED';
    interpretedAs.push('Furnishing: Unfurnished');
    text = text.replace(/\bunfurnished\b/gi, ' ');
  }

  // Freshness / recency
  if (/\b(today'?s?|posted today|inventory today)\b/i.test(text)) {
    delta.postedSince = 'today';
    interpretedAs.push('Posted: today');
    text = text.replace(/\b(today'?s?|posted today|inventory today)\b/gi, ' ');
  } else if (/\byesterday\b/i.test(text)) {
    delta.postedSince = 'yesterday';
    interpretedAs.push('Posted: yesterday');
    text = text.replace(/\byesterday\b/gi, ' ');
  } else if (/\b(this week|past 7 days|last 7 days)\b/i.test(text)) {
    delta.postedSince = '7d';
    interpretedAs.push('Posted: last 7 days');
    text = text.replace(/\b(this week|past 7 days|last 7 days)\b/gi, ' ');
  } else if (/\bfresh\b/i.test(text)) {
    delta.freshness = 'FRESH';
    interpretedAs.push('Freshness: Fresh');
    text = text.replace(/\bfresh\b/gi, ' ');
  }

  // Budget / rent ceilings & floors
  const under = text.match(
    /\b(?:below|under|less than|upto|up to|max(?:imum)?|budget(?:\s+under)?)\s*(?:rs\.?|₹)?\s*([\d,.]+)\s*(k|lakh|lac|l|cr)?\b/i,
  );
  if (under) {
    const amount = parseMoneyToken(under[1], under[2]);
    if (amount != null) {
      delta.maxRent = amount;
      interpretedAs.push(`Budget max: ₹${amount.toLocaleString('en-IN')}`);
      text = text.replace(under[0], ' ');
    }
  }
  const above = text.match(
    /\b(?:above|over|more than|min(?:imum)?)\s*(?:rs\.?|₹)?\s*([\d,.]+)\s*(k|lakh|lac|l|cr)?\b/i,
  );
  if (above) {
    const amount = parseMoneyToken(above[1], above[2]);
    if (amount != null) {
      delta.minRent = amount;
      interpretedAs.push(`Budget min: ₹${amount.toLocaleString('en-IN')}`);
      text = text.replace(above[0], ' ');
    }
  }

  // Explicit message phrases without quotes
  const phraseHints = [
    'keys with me',
    'company lease',
    'negotiable',
    'only family',
    'bachelor',
    'immediate',
  ];
  for (const phrase of phraseHints) {
    if (lower.includes(phrase)) {
      delta.messageKeyword = phrase;
      interpretedAs.push(`WhatsApp keyword: “${phrase}”`);
      text = text.replace(new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), ' ');
      break;
    }
  }

  // Broker-focused questions
  const brokerPosted = text.match(/\b(?:which\s+)?broker(?:\s+posted|\s+for|\s*:)?\s+(.+)$/i);
  if (/\bby broker\b|\bsearch by broker\b/i.test(lower)) {
    interpretedAs.push('Hint: mention a broker name to filter');
  }
  const brokerName = text.match(/\bbroker\s+([a-z][a-z\s.]{1,40})/i);
  if (brokerName && !/posted|name|search/i.test(brokerName[1])) {
    delta.broker = brokerName[1].trim();
    interpretedAs.push(`Broker: ${delta.broker}`);
    text = text.replace(brokerName[0], ' ');
  } else if (brokerPosted) {
    // "Which broker posted Kalpataru today?" → project token, not broker filter
    text = text.replace(/\bwhich\s+broker\s+posted\b/gi, ' ');
  }

  // Known project / locality from remaining tokens
  const cleaned = text
    .replace(/\b(show|me|find|any|all|listings?|inventory|available|in|for|the|a|an|only|with|where|wrote|posted|please|search)\b/gi, ' ')
    .replace(/[?!.]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (cleaned) {
    const cleanedLower = cleaned.toLowerCase();
    const matchedProject = knownProjects.find((p) => {
      const pl = p.toLowerCase();
      return cleanedLower.includes(pl) || pl.includes(cleanedLower);
    });
    if (matchedProject) {
      delta.project = matchedProject;
      interpretedAs.push(`Project: ${matchedProject}`);
    } else if (cleaned.length >= 3 && !delta.messageKeyword) {
      // Locality / project free text — use project regex + search fallback
      delta.project = cleaned;
      delta.search = cleaned;
      interpretedAs.push(`Location/project: ${cleaned}`);
    } else if (cleaned.length >= 3) {
      delta.search = cleaned;
      interpretedAs.push(`Search: ${cleaned}`);
    }
  }

  if (!interpretedAs.length) {
    interpretedAs.push('Broad inventory search');
    if (input.trim()) delta.search = input.trim();
  }

  return { delta, interpretedAs };
}

export function mergeAssistantState(
  previous: AssistantSearchState | undefined,
  delta: Partial<AssistantSearchState>,
  reset?: boolean,
): AssistantSearchState {
  if (reset) {
    return { ...delta, page: 1, pageSize: delta.pageSize || 20 };
  }
  return {
    ...(previous || {}),
    ...delta,
    page: 1,
    pageSize: previous?.pageSize || delta.pageSize || 20,
  };
}
