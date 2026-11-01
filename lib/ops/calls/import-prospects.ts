import type { Db } from 'mongodb';
import { createProspect, updateProspect } from '@/lib/ops/calls/prospect-store';
import {
  prospectIntentSchema,
  prospectPrioritySchema,
  prospectSourceSchema,
  prospectTypeSchema,
} from '@/lib/ops/calls/schemas';
import type { OpsProspect, ProspectPriority, ProspectSource, ProspectType } from '@/lib/ops/calls/types';
import { normalizeOutreachPhone } from '@/lib/ops/outreach-phone';

export type ImportRowAction = 'create' | 'update' | 'skip';

export type ImportPlanRow = {
  index: number;
  action: ImportRowAction;
  name?: string;
  phone?: string;
  reason?: string;
  existingId?: string;
};

export type ImportSummary = {
  total: number;
  creates: number;
  updates: number;
  skips: number;
};

export type ImportPlan = {
  summary: ImportSummary;
  rows: ImportPlanRow[];
};

type ImportDraft = {
  name?: string;
  phone: string;
  alternatePhone?: string;
  email?: string;
  prospectType: ProspectType;
  projectName?: string;
  building?: string;
  unit?: string;
  location?: string;
  requirement?: string;
  notes?: string;
  source: ProspectSource;
  priority?: ProspectPriority;
  wave?: number;
  batch?: string;
  campaignTag?: string;
  unitCount?: number;
  salutation?: string;
};

type PlannedWrite = {
  row: ImportPlanRow;
  draft?: ImportDraft;
  existingId?: string;
};

const MAX_ROWS = 5000;

function cleanString(value: unknown, max: number): string | undefined {
  if (typeof value !== 'string' && typeof value !== 'number') return undefined;
  const trimmed = String(value).trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, max);
}

function cleanRow(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    const normalizedKey = key.replace(/^\uFEFF/, '').trim();
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) continue;
      out[normalizedKey] = trimmed;
    } else if (value != null) {
      out[normalizedKey] = value;
    }
  }
  return out;
}

function parseCsv(text: string): Record<string, unknown>[] {
  const rows: string[][] = [];
  let cell = '';
  let row: string[] = [];
  let inQuotes = false;
  const source = text.replace(/^\uFEFF/, '');

  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    const next = source[i + 1];
    if (inQuotes) {
      if (char === '"' && next === '"') {
        cell += '"';
        i += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        cell += char;
      }
      continue;
    }
    if (char === '"') {
      inQuotes = true;
      continue;
    }
    if (char === ',') {
      row.push(cell);
      cell = '';
      continue;
    }
    if (char === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
      continue;
    }
    if (char === '\r') continue;
    cell += char;
  }
  if (cell.length || row.length) {
    row.push(cell);
    rows.push(row);
  }

  const header = (rows.shift() || []).map((column) => column.replace(/^\uFEFF/, '').trim());
  if (!header.some((column) => column.toLowerCase() === 'phone')) {
    throw Object.assign(new Error('CSV must include a phone column.'), { status: 400 });
  }

  return rows
    .filter((columns) => columns.some((value) => value.trim()))
    .map((columns) => {
      const record: Record<string, unknown> = {};
      header.forEach((column, index) => {
        if (!column) return;
        record[column] = columns[index] ?? '';
      });
      return record;
    });
}

export function parseProspectImportDocument(text: string, filename?: string): unknown[] {
  const trimmed = text.replace(/^\uFEFF/, '').trim();
  if (!trimmed) {
    throw Object.assign(new Error('Import file is empty.'), { status: 400 });
  }
  const lowerName = (filename || '').toLowerCase();
  const looksJson = lowerName.endsWith('.json') || trimmed.startsWith('[') || trimmed.startsWith('{');
  if (looksJson) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      throw Object.assign(new Error('Import JSON could not be parsed.'), { status: 400 });
    }
    if (Array.isArray(parsed)) return parsed;
    if (parsed && typeof parsed === 'object') {
      const record = parsed as { rows?: unknown; prospects?: unknown };
      if (Array.isArray(record.rows)) return record.rows;
      if (Array.isArray(record.prospects)) return record.prospects;
    }
    throw Object.assign(new Error('Import JSON must be an array of prospects.'), { status: 400 });
  }
  return parseCsv(trimmed);
}

function draftFromRow(row: Record<string, unknown>): { draft?: ImportDraft; reason?: string } {
  const phoneRaw = cleanString(row.phone ?? row.mobile ?? row.Phone, 20);
  if (!phoneRaw) return { reason: 'missing_phone' };
  const normalized = normalizeOutreachPhone(phoneRaw);
  if (!normalized) return { reason: 'invalid_phone' };

  const prospectTypeRaw = cleanString(row.prospectType, 40) || 'homeowner';
  const prospectTypeParsed = prospectTypeSchema.safeParse(prospectTypeRaw);
  if (!prospectTypeParsed.success) return { reason: 'invalid_prospect_type' };

  const sourceRaw = cleanString(row.source, 40) || 'csv_import';
  const sourceParsed = prospectSourceSchema.safeParse(sourceRaw);
  if (!sourceParsed.success) return { reason: 'invalid_source' };

  let priority: ProspectPriority | undefined;
  const priorityRaw = cleanString(row.priority, 8);
  if (priorityRaw) {
    const parsed = prospectPrioritySchema.safeParse(priorityRaw);
    if (!parsed.success) return { reason: 'invalid_priority' };
    priority = parsed.data;
  }

  let wave: number | undefined;
  if (row.wave != null && String(row.wave).trim() !== '') {
    const parsedWave = Number(row.wave);
    if (!Number.isInteger(parsedWave) || parsedWave < 1 || parsedWave > 99) {
      return { reason: 'invalid_wave' };
    }
    wave = parsedWave;
  }

  let unitCount: number | undefined;
  if (row.unitCount != null && String(row.unitCount).trim() !== '') {
    const parsedCount = Number(row.unitCount);
    if (!Number.isInteger(parsedCount) || parsedCount < 0 || parsedCount > 99) {
      return { reason: 'invalid_unit_count' };
    }
    unitCount = parsedCount;
  }

  const email = cleanString(row.email, 254);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { reason: 'invalid_email' };

  const alternateRaw = cleanString(row.alternatePhone, 20);
  let alternatePhone: string | undefined;
  if (alternateRaw) {
    const alternate = normalizeOutreachPhone(alternateRaw);
    if (!alternate) return { reason: 'invalid_phone' };
    alternatePhone = alternate.phone;
  }

  const intentRaw = cleanString(row.intent, 20);
  if (intentRaw && !prospectIntentSchema.safeParse(intentRaw).success) {
    return { reason: 'invalid_intent' };
  }

  return {
    draft: {
      name: cleanString(row.name, 160),
      phone: normalized.phone,
      alternatePhone,
      email,
      prospectType: prospectTypeParsed.data,
      projectName: cleanString(row.projectName, 200),
      building: cleanString(row.building, 200),
      unit: cleanString(row.unit, 200),
      location: cleanString(row.location, 200),
      requirement: cleanString(row.requirement, 2000),
      notes: cleanString(row.notes, 4000),
      source: sourceParsed.data,
      priority,
      wave,
      batch: cleanString(row.batch, 80),
      campaignTag: cleanString(row.campaignTag, 120),
      unitCount,
      salutation: cleanString(row.salutation, 80),
    },
  };
}

function indexExisting(existing: OpsProspect[]): Map<string, OpsProspect> {
  const map = new Map<string, OpsProspect>();
  const ordered = [...existing].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  for (const prospect of ordered) {
    const normalized = normalizeOutreachPhone(prospect.phone);
    const key = normalized?.phone || prospect.phone;
    if (!map.has(key)) map.set(key, prospect);
  }
  return map;
}

export function planProspectImport(rows: unknown[], existing: OpsProspect[] = []): {
  plan: ImportPlan;
  writes: PlannedWrite[];
} {
  if (rows.length > MAX_ROWS) {
    throw Object.assign(new Error(`Import is limited to ${MAX_ROWS} rows.`), { status: 400 });
  }

  const byPhone = indexExisting(existing);
  const seen = new Set<string>();
  const planRows: ImportPlanRow[] = [];
  const writes: PlannedWrite[] = [];

  rows.forEach((raw, index) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      const row: ImportPlanRow = { index, action: 'skip', reason: 'invalid_row' };
      planRows.push(row);
      writes.push({ row });
      return;
    }
    const parsed = draftFromRow(cleanRow(raw as Record<string, unknown>));
    if (!parsed.draft) {
      const row: ImportPlanRow = { index, action: 'skip', reason: parsed.reason || 'invalid_row' };
      planRows.push(row);
      writes.push({ row });
      return;
    }
    const draft = parsed.draft;
    if (seen.has(draft.phone)) {
      const row: ImportPlanRow = {
        index,
        action: 'skip',
        name: draft.name,
        phone: draft.phone,
        reason: 'duplicate_in_file',
      };
      planRows.push(row);
      writes.push({ row });
      return;
    }
    seen.add(draft.phone);
    const match = byPhone.get(draft.phone);
    if (match) {
      const row: ImportPlanRow = {
        index,
        action: 'update',
        name: draft.name || match.name,
        phone: draft.phone,
        existingId: match.id,
      };
      planRows.push(row);
      writes.push({ row, draft, existingId: match.id });
      return;
    }
    const row: ImportPlanRow = {
      index,
      action: 'create',
      name: draft.name,
      phone: draft.phone,
    };
    planRows.push(row);
    writes.push({ row, draft });
  });

  const summary = {
    total: planRows.length,
    creates: planRows.filter((row) => row.action === 'create').length,
    updates: planRows.filter((row) => row.action === 'update').length,
    skips: planRows.filter((row) => row.action === 'skip').length,
  };
  return { plan: { summary, rows: planRows }, writes };
}

function definedFields(draft: ImportDraft): Partial<OpsProspect> {
  const patch: Partial<OpsProspect> = {};
  const entries = Object.entries(draft) as Array<[keyof ImportDraft, ImportDraft[keyof ImportDraft]]>;
  for (const [key, value] of entries) {
    if (value == null || value === '') continue;
    (patch as Record<string, unknown>)[key] = value;
  }
  return patch;
}

export async function commitProspectImport(
  db: Db,
  rows: unknown[],
  existing: OpsProspect[],
  createdBy: string,
): Promise<ImportPlan> {
  const { plan, writes } = planProspectImport(rows, existing);
  for (const write of writes) {
    if (!write.draft) continue;
    if (write.row.action === 'create') {
      await createProspect(db, {
        ...definedFields(write.draft),
        phone: write.draft.phone,
        prospectType: write.draft.prospectType,
        source: write.draft.source,
        optOut: false,
        doNotContact: false,
        createdBy,
      });
    } else if (write.row.action === 'update' && write.existingId) {
      const patch = definedFields(write.draft);
      delete patch.phone;
      await updateProspect(db, write.existingId, patch);
    }
  }
  return plan;
}
