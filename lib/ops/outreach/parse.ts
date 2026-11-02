import { parseCsv } from '@/lib/ops/csv';
import { ProjectValidationError } from '@/lib/ops/projects/errors';
import { OUTREACH_AUDIENCES, OUTREACH_STATUSES, type OutreachAudience } from '@/lib/ops/outreach/types';

const ALIASES: Record<string, string> = {
  audience: 'audience',
  wave: 'wave',
  priority: 'priority',
  project: 'project',
  tower: 'tower',
  floor: 'floor',
  bhk: 'bhk',
  flats: 'flats',
  name: 'name',
  role: 'role',
  phone: 'phone',
  phone_e164: 'phone',
  email: 'email',
  signal: 'signal',
  lease_end: 'lease_end',
  'lease end': 'lease_end',
  already_contacted: 'already_contacted',
  status: 'status',
  notes: 'notes',
  message: 'message',
};

export type OutreachRow = Record<string, string>;

export function parseOutreachCsv(text: string): OutreachRow[] {
  const rows = parseCsv(text);
  if (rows.length < 2) throw new ProjectValidationError('The CSV needs a header and at least one contact.');
  const headers = rows[0].map((header) => ALIASES[header.trim().toLowerCase()] || '');
  if (!headers.includes('phone') || !headers.includes('audience')) {
    throw new ProjectValidationError('CSV needs audience and phone columns.');
  }
  return rows.slice(1).map((row) => {
    const record: OutreachRow = {};
    headers.forEach((key, index) => {
      if (key) record[key] = row[index] || '';
    });
    return record;
  }).filter((row) => row.phone && row.audience);
}

export function parseTemplatesJson(text: string): Partial<Record<OutreachAudience, string>> {
  const parsed = JSON.parse(text) as Record<string, unknown>;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new ProjectValidationError('Templates JSON must be an object keyed by audience.');
  }
  const templates: Partial<Record<OutreachAudience, string>> = {};
  Object.entries(parsed).forEach(([key, value]) => {
    if (!(OUTREACH_AUDIENCES as readonly string[]).includes(key)) return;
    const body = typeof value === 'string' ? value : (value && typeof value === 'object' ? String((value as { body?: string }).body || '') : '');
    if (body) templates[key as OutreachAudience] = body;
  });
  return templates;
}

export function isOutreachStatus(value: string): boolean {
  return (OUTREACH_STATUSES as readonly string[]).includes(value);
}
