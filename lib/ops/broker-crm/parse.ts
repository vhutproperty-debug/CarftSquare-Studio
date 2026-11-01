import { BrokerCrmParseError } from '@/lib/ops/broker-crm/errors';
import { normalizeOutreachPhone } from '@/lib/ops/outreach-phone';
import { splitGroupList } from '@/lib/ops/broker-crm/tags';
import type { BrokerImportRow } from '@/lib/ops/broker-crm/types';
import { readXlsxRows } from '@/lib/ops/broker-crm/xlsx';

export { BrokerCrmParseError };

const MAX_FILE_BYTES = 8 * 1024 * 1024;
const MAX_ROWS = 10000;

function headerKey(value: string): string {
  return value.trim().toLowerCase().replace(/[\s-]+/g, '_');
}

function rowsFromMatrix(matrix: string[][]): BrokerImportRow[] {
  if (!matrix.length) throw new BrokerCrmParseError('The file has no rows.');
  const header = matrix[0].map(headerKey);
  const phoneIndex = header.findIndex((cell) => cell === 'phone' || cell === 'mobile' || cell === 'number');
  if (phoneIndex < 0) {
    throw new BrokerCrmParseError('The file needs a phone column.');
  }
  const nameIndex = header.findIndex((cell) => cell === 'name' || cell === 'broker' || cell === 'broker_name');
  const groupsIndex = header.findIndex((cell) => cell === 'groups' || cell === 'group' || cell === 'whatsapp_groups');
  const adminIndex = header.findIndex((cell) => cell === 'admin' || cell === 'is_admin' || cell === 'group_admin');
  const data = matrix.slice(1);
  if (data.length > MAX_ROWS) {
    throw new BrokerCrmParseError(`The file has more than ${MAX_ROWS} rows.`);
  }
  return data.map((row) => ({
    phoneRaw: String(row[phoneIndex] || '').trim(),
    name: nameIndex >= 0 ? String(row[nameIndex] || '').trim().slice(0, 120) : '',
    groupsRaw: groupsIndex >= 0 ? String(row[groupsIndex] || '').trim() : '',
    adminRaw: adminIndex >= 0 ? String(row[adminIndex] || '').trim() : '',
  }));
}

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  const src = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        cell += ch;
      }
      continue;
    }
    if (ch === '"') {
      quoted = true;
      continue;
    }
    if (ch === ',') {
      row.push(cell);
      cell = '';
      continue;
    }
    if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i += 1;
      row.push(cell);
      cell = '';
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      continue;
    }
    cell += ch;
  }
  row.push(cell);
  if (row.some((value) => value.trim())) rows.push(row);
  return rows;
}

export function parseBrokerCrmMatrix(matrix: string[][]): BrokerImportRow[] {
  return rowsFromMatrix(matrix);
}

export function parseBrokerCrmFile(filename: string, bytes: Buffer): BrokerImportRow[] {
  if (bytes.length > MAX_FILE_BYTES) {
    throw new BrokerCrmParseError('The file is larger than 8 MB.');
  }
  const lower = filename.toLowerCase();
  if (lower.endsWith('.csv')) {
    return rowsFromMatrix(parseCsv(bytes.toString('utf8')));
  }
  if (lower.endsWith('.xlsx')) {
    return rowsFromMatrix(readXlsxRows(bytes));
  }
  throw new BrokerCrmParseError('Upload a .xlsx or .csv file. The spreadsheet stays on this machine and is not stored in git.');
}

export function canonicalPhone(value: string): string | null {
  return normalizeOutreachPhone(value)?.phone || null;
}

export function parseAdminFlag(value: string): boolean {
  return /^(y|yes|true|1)$/i.test(value.trim());
}

export function parseGroups(value: string): string[] {
  return splitGroupList(value).slice(0, 50).map((group) => group.slice(0, 200));
}
