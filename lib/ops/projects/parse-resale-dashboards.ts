import {
  elysianConfig,
  firstCrore,
  floorBandFromFloor,
  listingTypeForStatus,
  parseBhk,
  parseCarpetSqft,
  privateUnitSlug,
  splitFlat,
} from '@/lib/ops/projects/resale-identity';
import type { ResaleFollowUp, ResaleOwner, ResalePriority, ResaleUnitStatus } from '@/lib/ops/projects/types';

export type ImportedResaleUnit = {
  slug: string;
  projectSlug: string;
  unitNumber: string;
  tower: string;
  floor: string;
  floorBand: string;
  bhk: number | null;
  carpetSqft: number | null;
  configLabel: string;
  status: ResaleUnitStatus;
  listingType: 'resale' | 'rental';
  askingPriceCrore: number | null;
  askingPriceLabel: string;
  offerTag: string;
  owner: ResaleOwner;
  intent: string;
  response: string;
  nextAction: string;
  priority: ResalePriority;
  notes: string;
  campaign: string;
  asOf: string;
  followUps: ResaleFollowUp[];
};

export type DashboardBundle = {
  kind: 'sky' | 'elysian' | 'park';
  project: {
    name: string;
    slug: string;
    developer: string;
    locality: string;
    towers: string[];
    notes: string;
  };
  units: ImportedResaleUnit[];
};

const ELYSIAN_CONFIG_NOTE = 'Config map: Tower A 01/06 = 4BHK Signature; Tower A 02/05 = 3BHK Palatial; Tower B 05/06 = 4BHK Elite.';

export function classifyDashboard(html: string, filename = ''): DashboardBundle['kind'] | null {
  const name = filename.toLowerCase();
  if (html.includes('const inventory') && (name.includes('sky') || html.toLowerCase().includes('skycity') || html.includes('tagLabel'))) {
    return 'sky';
  }
  if (html.includes('const DATA') && html.includes('"followups"') && html.includes('"tower_cfg"')) return 'elysian';
  if (html.includes('const DATA') && html.includes('"live"') && html.includes('"diary"')) return 'park';
  if (name.includes('elysian')) return 'elysian';
  if (name.includes('34') && name.includes('park')) return 'park';
  if (name.includes('sky')) return 'sky';
  return null;
}

export function parseDashboardHtml(html: string, filename = ''): DashboardBundle {
  const kind = classifyDashboard(html, filename);
  if (kind === 'sky') return parseSky(html);
  if (kind === 'elysian') return parseElysian(html);
  if (kind === 'park') return parsePark(html);
  throw new Error(`Could not tell which dashboard “${filename || 'file'}” is. Expected Sky City, Elysian, or 34 Park.`);
}

function parseSky(html: string): DashboardBundle {
  const arrayText = extractLiteral(html, 'inventory');
  const json = arrayText
    .replace(/([{,]\s*)([A-Za-z_][A-Za-z0-9_]*)\s*:/g, '$1"$2":')
    .replace(/,\s*([}\]])/g, '$1');
  const rows = JSON.parse(json) as Array<Record<string, unknown>>;
  const projectSlug = 'oberoi-sky-city';
  const units = rows.map((row) => {
    const flat = splitFlat(String(row.unit || ''), String(row.tower || ''));
    const floor = row.floor != null && row.floor !== '' ? String(row.floor) : flat.floor;
    const price = typeof row.price === 'number' ? row.price : firstCrore(String(row.price || ''));
    const draft = blankUnit(projectSlug, flat.unitNumber || String(row.unit || ''), flat.tower, floor);
    draft.status = 'for_sale';
    draft.listingType = 'resale';
    draft.askingPriceCrore = price;
    draft.askingPriceLabel = price != null ? `₹${price} Cr` : '';
    draft.offerTag = stripPhones(String(row.tagLabel || ''));
    draft.campaign = 'for-sale snapshot';
    return draft;
  }).filter((unit) => unit.unitNumber);
  return {
    kind: 'sky',
    project: {
      name: 'Oberoi Sky City',
      slug: projectSlug,
      developer: 'Oberoi Realty',
      locality: 'Borivali East',
      towers: unique(units.map((unit) => unit.tower)),
      notes: summaryBlock('For-sale snapshot. Offer tags stay on each unit. Flat numbers are not repeated here.'),
    },
    units,
  };
}

function parseElysian(html: string): DashboardBundle {
  const data = JSON.parse(extractLiteral(html, 'DATA')) as Record<string, unknown>;
  const projectSlug = 'oberoi-elysian';
  const asOf = String(data.as_of || '');
  const map = new Map<string, ImportedResaleUnit>();
  const ingest = (rows: unknown, campaign: string, board: boolean) => {
    if (!Array.isArray(rows)) return;
    rows.forEach((row) => {
      if (!row || typeof row !== 'object') return;
      mergeRow(map, projectSlug, row as Record<string, unknown>, campaign, asOf, board, true);
    });
  };
  ingest(data.campaign_4bhk, '4BHK campaign', false);
  ingest(data.series06, 'series 06', false);
  ingest(data.series05, 'series 05', false);
  ingest(data.wrong_outreach, 'wrong outreach', false);
  ingest(data.availability, 'availability', false);
  ingest(data.followups, 'follow-up board', true);
  const units = [...map.values()];
  return {
    kind: 'elysian',
    project: {
      name: 'Oberoi Elysian',
      slug: projectSlug,
      developer: 'Oberoi Realty',
      locality: 'Goregaon East',
      towers: unique(units.map((unit) => unit.tower)),
      notes: summaryBlock([
        `As of ${asOf}.`,
        ELYSIAN_CONFIG_NOTE,
        formatTotals(data.totals),
        formatPairs('Contact status', data.contact_status),
      ].filter(Boolean).join('\n')),
    },
    units,
  };
}

function parsePark(html: string): DashboardBundle {
  const data = JSON.parse(extractLiteral(html, 'DATA')) as Record<string, unknown>;
  const projectSlug = '34-park';
  const asOf = String(data.as_of || '');
  const map = new Map<string, ImportedResaleUnit>();
  if (Array.isArray(data.live)) {
    data.live.forEach((row) => {
      if (!row || typeof row !== 'object') return;
      mergeRow(map, projectSlug, row as Record<string, unknown>, 'live', asOf, false, false);
    });
  }
  if (Array.isArray(data.diary)) {
    data.diary.forEach((row) => {
      if (!row || typeof row !== 'object') return;
      const record = row as Record<string, unknown>;
      mergeRow(map, projectSlug, {
        ...record,
        status: 'follow-up',
        next: record.why,
        as_of: record.when || asOf,
      }, 'diary', String(record.when || asOf), true, false);
    });
  }
  const units = [...map.values()];
  const totals = data.totals && typeof data.totals === 'object' ? data.totals as Record<string, unknown> : {};
  return {
    kind: 'park',
    project: {
      name: '34 Park',
      slug: projectSlug,
      developer: '',
      locality: 'Goregaon',
      towers: unique(units.map((unit) => unit.tower)),
      notes: summaryBlock(`As of ${asOf}.\nLive listings ${textNum(totals.live)} (sale ${textNum(totals.sale)}, rent ${textNum(totals.rent)}). Diary items ${textNum(totals.diary)}.`),
    },
    units,
  };
}

function mergeRow(
  map: Map<string, ImportedResaleUnit>,
  projectSlug: string,
  row: Record<string, unknown>,
  campaign: string,
  asOf: string,
  isFollowUp: boolean,
  useElysianMap: boolean,
) {
  const rawUnit = String(row.unit || row.flat || '').trim();
  if (!rawUnit) return;
  const flat = splitFlat(rawUnit, String(row.tower || row.wing || ''));
  const unitNumber = flat.unitNumber || rawUnit;
  const key = unitNumber.toUpperCase();
  const floor = row.floor != null && String(row.floor).trim() ? String(row.floor).trim() : flat.floor;
  const tower = flat.tower || String(row.tower || row.wing || '').trim().toUpperCase();
  const existing = map.get(key) || blankUnit(projectSlug, unitNumber, tower, floor);
  if (tower && !existing.tower) existing.tower = tower;
  if (floor && !existing.floor) {
    existing.floor = floor;
    existing.floorBand = floorBandFromFloor(floor);
  }
  const configText = stripPhones(String(row.detail || row.config || row.cfg || ''));
  const mapped = useElysianMap ? elysianConfig(existing.tower, flat.series) : null;
  if (!existing.configLabel) existing.configLabel = configText || mapped?.configLabel || '';
  if (existing.bhk == null) existing.bhk = parseBhk(String(row.bhk || row.cfg || row.detail || row.config || '')) ?? mapped?.bhk ?? null;
  if (existing.carpetSqft == null) existing.carpetSqft = parseCarpetSqft(String(row.config || row.detail || ''));
  const status = statusFrom(row);
  const alreadyListed = existing.status === 'for_sale' || existing.status === 'for_rent' || existing.status === 'sold' || existing.status === 'rented';
  if (!alreadyListed) {
    existing.status = status;
    existing.listingType = listingTypeForStatus(status);
  }
  const askingText = stripPhones(String(row.asking || row.ask || ''));
  const numericPrice = typeof row.price === 'number' ? row.price : firstCrore(askingText || String(row.price || ''));
  if (!existing.askingPriceLabel && askingText) existing.askingPriceLabel = askingText;
  if (existing.askingPriceCrore == null && numericPrice != null) {
    existing.askingPriceCrore = numericPrice;
    if (!existing.askingPriceLabel) existing.askingPriceLabel = `₹${numericPrice} Cr`;
  }
  if (!existing.offerTag) existing.offerTag = stripPhones(String(row.tagLabel || ''));
  fillOwner(existing.owner, {
    name: String(row.owner || ''),
    phone: String(row.phone || ''),
    email: '',
    whatsapp: String(row.wa || ''),
  });
  if (!existing.intent) existing.intent = stripPhones(String(row.intent || row.selling || row.interest || ''));
  if (!existing.response) existing.response = stripPhones(String(row.response || ''));
  if (!existing.nextAction) existing.nextAction = stripPhones(String(row.next || row.doThis || row.action || ''));
  const priority = priorityFrom(row);
  if (!existing.priority && priority) existing.priority = priority;
  if (!existing.asOf) existing.asOf = String(row.as_of || row.campaign_date || row.when || asOf || '');
  existing.campaign = joinUnique(existing.campaign, campaign);
  const extra = stripPhones([row.ftype, row.wrong_flag ? 'Needs verification before another send.' : ''].filter(Boolean).join(' · '));
  if (extra && !existing.notes.includes(extra)) existing.notes = joinUnique(existing.notes, extra);
  if (isFollowUp) {
    const note = stripPhones([row.intent, row.response, row.next, row.why, row.notes, row.doThis].map((part) => String(part || '').trim()).filter(Boolean).join(' · '));
    if (note) {
      existing.followUps.push({
        id: `${existing.slug}-${existing.followUps.length + 1}`,
        at: String(row.when || row.as_of || asOf || ''),
        by: 'import',
        note,
        source: 'import',
      });
    }
  }
  map.set(key, existing);
}

function blankUnit(projectSlug: string, unitNumber: string, tower: string, floor: string): ImportedResaleUnit {
  return {
    slug: privateUnitSlug(projectSlug, unitNumber),
    projectSlug,
    unitNumber,
    tower,
    floor,
    floorBand: floorBandFromFloor(floor),
    bhk: null,
    carpetSqft: null,
    configLabel: '',
    status: 'available',
    listingType: 'resale',
    askingPriceCrore: null,
    askingPriceLabel: '',
    offerTag: '',
    owner: { name: '', phone: '', email: '', whatsapp: '' },
    intent: '',
    response: '',
    nextAction: '',
    priority: '',
    notes: '',
    campaign: '',
    asOf: '',
    followUps: [],
  };
}

function statusFrom(row: Record<string, unknown>): ResaleUnitStatus {
  const avail = String(row.avail || '').toUpperCase();
  if (avail.includes('RENT')) return 'for_rent';
  if (avail.includes('SALE')) return 'for_sale';
  if (avail.includes('BUY')) return 'follow_up';
  const status = String(row.status || '').toUpperCase();
  if (status === 'RENT' || status.includes('FOR RENT')) return 'for_rent';
  if (status === 'SALE' || status.includes('FOR SALE')) return 'for_sale';
  if (status.includes('FOLLOW')) return 'follow_up';
  if (status === 'INTERIOR') return 'follow_up';
  if (row.next || row.doThis || status === 'REPLIED') return 'follow_up';
  return 'available';
}

function priorityFrom(row: Record<string, unknown>): ResalePriority {
  const label = String(row.priority || '').toUpperCase();
  if (label === 'HIGH' || label === 'MEDIUM' || label === 'LOW') return label;
  const rank = Number(row.pri);
  if (rank === 1) return 'HIGH';
  if (rank === 2) return 'MEDIUM';
  if (Number.isFinite(rank) && rank >= 3) return 'LOW';
  return '';
}

function fillOwner(target: ResaleOwner, source: ResaleOwner) {
  (['name', 'phone', 'email', 'whatsapp'] as const).forEach((key) => {
    if (!target[key] && source[key]) target[key] = source[key].trim();
  });
}

function joinUnique(current: string, next: string): string {
  const parts = [...current.split(';'), next].map((part) => part.trim()).filter(Boolean);
  return [...new Set(parts)].join('; ');
}

function stripPhones(value: string): string {
  return value.replace(/(?:\+?\d[\d\s().-]{8,}\d)/g, '').replace(/\s{2,}/g, ' ').trim();
}

function formatTotals(value: unknown): string {
  if (!value || typeof value !== 'object') return '';
  const totals = value as Record<string, unknown>;
  const parts = [
    ['master', 'master'],
    ['3bhk', '3BHK'],
    ['4bhk', '4BHK'],
    ['for_sale_3bhk', 'for sale 3BHK'],
    ['for_sale_4bhk', 'for sale 4BHK'],
    ['for_rent', 'for rent'],
    ['buyers', 'buyers'],
    ['followups', 'follow-ups'],
    ['contacted', 'contacted'],
  ];
  return `Totals: ${parts.map(([key, label]) => `${label} ${textNum(totals[key])}`).join('; ')}.`;
}

function formatPairs(label: string, value: unknown): string {
  if (!value || typeof value !== 'object') return '';
  const pairs = Object.entries(value as Record<string, unknown>).map(([key, count]) => `${key} ${textNum(count)}`);
  return `${label}: ${pairs.join('; ')}.`;
}

function textNum(value: unknown): string {
  return value == null || value === '' ? '0' : String(value);
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort();
}

export function summaryBlock(body: string): string {
  return `[resale-dashboard]\n${stripPhones(body)}\n[/resale-dashboard]`;
}

export function mergeDashboardNotes(existing: string, block: string): string {
  const pattern = /\[resale-dashboard\][\s\S]*?\[\/resale-dashboard\]/;
  if (pattern.test(existing)) return existing.replace(pattern, block).trim();
  return [existing.trim(), block].filter(Boolean).join('\n\n');
}

function extractLiteral(source: string, name: string): string {
  const token = new RegExp(`const\\s+${name}\\s*=`);
  const match = token.exec(source);
  if (!match) throw new Error(`Missing const ${name}.`);
  const from = match.index + match[0].length;
  const start = source.slice(from).search(/[{[]/);
  if (start < 0) throw new Error(`const ${name} has no value.`);
  return balanced(source, from + start);
}

function balanced(source: string, index: number): string {
  const open = source[index];
  const close = open === '{' ? '}' : ']';
  let depth = 0;
  let quote = '';
  let escaped = false;
  for (let cursor = index; cursor < source.length; cursor += 1) {
    const char = source[cursor];
    if (quote) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === '\\') {
        escaped = true;
        continue;
      }
      if (char === quote) quote = '';
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (char === open) depth += 1;
    else if (char === close) {
      depth -= 1;
      if (depth === 0) return source.slice(index, cursor + 1);
    }
  }
  throw new Error('The dashboard value was cut off.');
}
