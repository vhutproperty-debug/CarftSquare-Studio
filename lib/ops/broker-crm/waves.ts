import { bhkLabel, cleanPlaceLabel, furnishingLabel, normalizeBhk, normalizeFurnishing } from '@/lib/ops/market/normalize';
import { PRICE_LINE } from '@/lib/ops/market/share-card';
import { BrokerCrmPrivacyError, isDoNotContact, isSensitiveBrokerFacingText } from '@/lib/ops/broker-crm/privacy';
import type { BrokerCrmStatus, OpsBrokerCrmRecord } from '@/lib/ops/broker-crm/types';

export type WaveId = 1 | 2 | 3;

export const WAVE_SENDS_WHATSAPP = false;

export const WAVE_LABELS: Record<WaveId, string> = {
  1: 'Wave 1',
  2: 'Wave 2',
  3: 'Wave 3',
};

export const WAVE_DESCRIPTIONS: Record<WaveId, string> = {
  1: 'Four or more groups. Highest counts first. Admins come first when the count ties.',
  2: 'Exactly three groups. Admins come first.',
  3: 'Exactly two groups. Admins come first.',
};

/** Floor copy allowed on a broker-facing template. Exact floors are not in this list. */
export const WAVE_FLOOR_BANDS = [
  'Floor range on request',
  'Ground floor',
  'Lower floor 1-7',
  'Lower mid floor 8-14',
  'Mid floor 15-25',
  'Higher floor 26-35',
  'High floor 36-45',
  'Top floor 46+',
] as const;

export type WaveFloorBand = (typeof WAVE_FLOOR_BANDS)[number];

export type WaveTemplateInput = {
  bhk?: string | null;
  floorBand?: string | null;
  furnishing?: string | null;
  project?: string | null;
};

export type WaveMessageTemplate = {
  bhk: string;
  floorBand: WaveFloorBand;
  furnishing: string;
  project: string;
  priceLine: typeof PRICE_LINE;
  lines: string[];
  text: string;
};

export type WaveRow = {
  id: string;
  name: string;
  phone: string;
  groupCount: number;
  groups: string[];
  status: BrokerCrmStatus;
  lastContactedAt: string | null;
  admin: boolean;
  wave: WaveId;
};

export type WaveApproval = {
  id: string;
  wave: WaveId;
  approvedAt: string;
  approvedById: string;
  approvedByEmail: string;
  recipientCount: number;
  template: string | null;
  /** Always false. Approval never sends a WhatsApp message. */
  sent: false;
};

const UNIT_LIKE = /\b[A-Za-z]{1,2}-\d{3,5}\b/;

const FURNISHING_LINES = ['Furnishing on request', 'Furnished', 'Semi-furnished', 'Unfurnished'] as const;

function furnishingLine(value?: string | null): string {
  const trimmed = (value || '').trim();
  if (!trimmed || trimmed === 'Furnishing on request') return 'Furnishing on request';
  if ((FURNISHING_LINES as readonly string[]).includes(trimmed)) return trimmed;
  return furnishingLabel(normalizeFurnishing(trimmed));
}

export function waveForGroupCount(groupCount: number): WaveId | null {
  if (groupCount >= 4) return 1;
  if (groupCount === 3) return 2;
  if (groupCount === 2) return 3;
  return null;
}

export function compareWaveRows(a: Pick<WaveRow, 'groupCount' | 'admin' | 'name' | 'phone'>, b: Pick<WaveRow, 'groupCount' | 'admin' | 'name' | 'phone'>): number {
  if (a.groupCount !== b.groupCount) return b.groupCount - a.groupCount;
  if (a.admin !== b.admin) return a.admin ? -1 : 1;
  const name = a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  if (name !== 0) return name;
  return a.phone.localeCompare(b.phone);
}

function toWaveRow(record: OpsBrokerCrmRecord, wave: WaveId): WaveRow {
  return {
    id: record.id,
    name: record.name,
    phone: record.phone,
    groupCount: record.groupCount,
    groups: record.groups,
    status: record.status,
    lastContactedAt: record.lastContactedAt,
    admin: record.admin,
    wave,
  };
}

export function buildWhatsAppPriorityQueue(records: OpsBrokerCrmRecord[]): {
  waves: Record<WaveId, WaveRow[]>;
  counts: Record<WaveId, number>;
  excludedDoNotContact: number;
} {
  const waves: Record<WaveId, WaveRow[]> = { 1: [], 2: [], 3: [] };
  let excludedDoNotContact = 0;
  for (const record of records) {
    const wave = waveForGroupCount(record.groupCount);
    if (!wave) continue;
    if (isDoNotContact(record)) {
      excludedDoNotContact += 1;
      continue;
    }
    waves[wave].push(toWaveRow(record, wave));
  }
  for (const wave of [1, 2, 3] as WaveId[]) waves[wave].sort(compareWaveRows);
  return {
    waves,
    counts: { 1: waves[1].length, 2: waves[2].length, 3: waves[3].length },
    excludedDoNotContact,
  };
}

export function parseWaveId(value: unknown): WaveId | null {
  const number = Number(value);
  if (number === 1 || number === 2 || number === 3) return number;
  return null;
}

export function buildWaveMessageTemplate(input: WaveTemplateInput = {}): WaveMessageTemplate {
  const floorBand = (input.floorBand || 'Floor range on request').trim();
  if (!(WAVE_FLOOR_BANDS as readonly string[]).includes(floorBand)) {
    throw new BrokerCrmPrivacyError('Use a floor band. Exact floors stay off the message.');
  }
  const furnishing = furnishingLine(input.furnishing);
  const bhk = bhkLabel(normalizeBhk(input.bhk));
  let project = cleanPlaceLabel(input.project);
  if (!project) project = 'Project on request';
  if (isSensitiveBrokerFacingText(project) || UNIT_LIKE.test(project)) {
    throw new BrokerCrmPrivacyError('Project can\'t include flat numbers, owner details, prices, or brokerage.');
  }
  const lines = [bhk, floorBand as WaveFloorBand, furnishing, project, PRICE_LINE];
  return {
    bhk,
    floorBand: floorBand as WaveFloorBand,
    furnishing,
    project,
    priceLine: PRICE_LINE,
    lines,
    text: lines.join('\n'),
  };
}

function csvCell(value: string | number): string {
  const raw = String(value ?? '');
  const guarded = /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
  if (/[",\n\r]/.test(guarded)) return `"${guarded.replace(/"/g, '""')}"`;
  return guarded;
}

export function renderWaveCsv(rows: WaveRow[], templateInput?: WaveTemplateInput | null): string {
  const safeRows = rows.filter((row) => row.status !== 'do-not-contact');
  const template = templateInput ? buildWaveMessageTemplate(templateInput) : null;
  const header = template
    ? 'name,phone,group_count,groups,status,last_contacted,wave,message'
    : 'name,phone,group_count,groups,status,last_contacted,wave';
  const lines = safeRows.map((row) => {
    const cells = [
      row.name,
      row.phone,
      row.groupCount,
      row.groups.join('; '),
      row.status,
      row.lastContactedAt || '',
      row.wave,
    ];
    if (template) cells.push(template.text);
    return cells.map(csvCell).join(',');
  });
  return `\uFEFF${[header, ...lines].join('\n')}\n`;
}

export function buildWaveApproval(input: {
  id: string;
  wave: WaveId;
  approvedAt: string;
  approvedById: string;
  approvedByEmail: string;
  recipientCount: number;
  template?: string | null;
}): WaveApproval {
  return {
    id: input.id,
    wave: input.wave,
    approvedAt: input.approvedAt,
    approvedById: input.approvedById,
    approvedByEmail: input.approvedByEmail,
    recipientCount: input.recipientCount,
    template: input.template || null,
    sent: false,
  };
}
