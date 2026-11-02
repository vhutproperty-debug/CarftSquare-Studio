import { normalizeResaleStatus, slugify } from '@/lib/ops/projects/format';
import { ProjectValidationError } from '@/lib/ops/projects/errors';
import { readXlsxSheets } from '@/lib/ops/projects/xlsx';
import {
  firstCrore,
  floorBandFromFloor,
  listingTypeForStatus,
  parseBhk,
  parseCarpetSqft,
  privateUnitSlug,
  splitFlat,
} from '@/lib/ops/projects/resale-identity';
import type { ImportedResaleUnit } from '@/lib/ops/projects/parse-resale-dashboards';
import type { ResalePriority } from '@/lib/ops/projects/types';

const HEADER_ALIASES: Record<string, string> = {
  project: 'project',
  'project slug': 'projectSlug',
  projectslug: 'projectSlug',
  unit: 'unit',
  flat: 'unit',
  'flat number': 'unit',
  tower: 'tower',
  wing: 'tower',
  floor: 'floor',
  bhk: 'bhk',
  carpet: 'carpet',
  'carpet sqft': 'carpet',
  config: 'config',
  configuration: 'config',
  status: 'status',
  asking: 'asking',
  'asking price': 'asking',
  price: 'asking',
  offer: 'offer',
  'offer tag': 'offer',
  owner: 'owner',
  'owner name': 'owner',
  phone: 'phone',
  'owner phone': 'phone',
  whatsapp: 'whatsapp',
  wa: 'whatsapp',
  intent: 'intent',
  response: 'response',
  next: 'next',
  'next action': 'next',
  priority: 'priority',
  notes: 'notes',
  note: 'notes',
  campaign: 'campaign',
  as_of: 'asOf',
  'as of': 'asOf',
  asof: 'asOf',
};

export function parseResaleTable(filename: string, bytes: Buffer, defaultProject = ''): ImportedResaleUnit[] {
  const rows = filename.toLowerCase().endsWith('.csv') ? parseCsv(bytes.toString('utf8')) : sheetRows(bytes);
  if (rows.length < 2) throw new ProjectValidationError('The file needs a header row and at least one unit.');
  const headers = rows[0].map((header) => HEADER_ALIASES[header.trim().toLowerCase()] || '');
  if (!headers.includes('unit') && !headers.includes('project')) {
    throw new ProjectValidationError('Use columns such as project, unit, tower, floor, bhk, carpet, config, status, asking, offer, owner, phone, whatsapp, intent, response, next, priority, notes, campaign, as_of.');
  }
  return rows.slice(1).map((row) => {
    const record: Record<string, string> = {};
    headers.forEach((key, index) => {
      if (key) record[key] = (row[index] || '').trim();
    });
    if (!record.unit) return null;
    const projectName = record.project || defaultProject;
    const projectSlug = record.projectSlug ? slugify(record.projectSlug) : slugify(projectName);
    if (!projectSlug) throw new ProjectValidationError(`Unit ${record.unit} needs a project column or a default project.`);
    const flat = splitFlat(record.unit, record.tower || '');
    const floor = record.floor || flat.floor;
    const status = normalizeResaleStatus(record.status || 'available') || 'available';
    const asking = record.asking || '';
    const crore = firstCrore(asking);
    const priority = priorityOf(record.priority || '');
    return {
      slug: privateUnitSlug(projectSlug, flat.unitNumber || record.unit),
      projectSlug,
      unitNumber: flat.unitNumber || record.unit,
      tower: flat.tower,
      floor,
      floorBand: floorBandFromFloor(floor),
      bhk: record.bhk ? Number(record.bhk) || parseBhk(record.bhk) : parseBhk(record.config || ''),
      carpetSqft: record.carpet ? Number(String(record.carpet).replace(/,/g, '')) || parseCarpetSqft(record.carpet) : parseCarpetSqft(record.config || ''),
      configLabel: record.config || '',
      status,
      listingType: listingTypeForStatus(status),
      askingPriceCrore: crore,
      askingPriceLabel: asking,
      offerTag: record.offer || '',
      owner: { name: record.owner || '', phone: record.phone || '', email: '', whatsapp: record.whatsapp || '' },
      intent: record.intent || '',
      response: record.response || '',
      nextAction: record.next || '',
      priority,
      notes: record.notes || '',
      campaign: record.campaign || 'spreadsheet',
      asOf: record.asOf || '',
      followUps: [],
    } satisfies ImportedResaleUnit;
  }).filter((unit): unit is ImportedResaleUnit => Boolean(unit));
}

function priorityOf(value: string): ResalePriority {
  const label = value.toUpperCase();
  if (label === 'HIGH' || label === 'MEDIUM' || label === 'LOW') return label;
  return '';
}

function sheetRows(bytes: Buffer): string[][] {
  const sheets = readXlsxSheets(bytes);
  return sheets[0]?.rows || [];
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quote = false;
  const source = text.replace(/^\uFEFF/, '');
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (quote) {
      if (char === '"') {
        if (source[index + 1] === '"') {
          cell += '"';
          index += 1;
        } else quote = false;
      } else cell += char;
      continue;
    }
    if (char === '"') quote = true;
    else if (char === ',') {
      row.push(cell.trim());
      cell = '';
    } else if (char === '\n') {
      row.push(cell.trim());
      rows.push(row);
      row = [];
      cell = '';
    } else if (char !== '\r') cell += char;
  }
  if (cell || row.length) {
    row.push(cell.trim());
    rows.push(row);
  }
  return rows.filter((line) => line.some(Boolean));
}
