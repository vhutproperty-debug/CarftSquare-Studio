import { parseCsv } from '@/lib/ops/csv';
import { recordsFromTable, suggestMapping, type CanonicalField } from '@/lib/ops/contacts/columns';
import { ContactValidationError } from '@/lib/ops/contacts/errors';
import { readXlsxSheets } from '@/lib/ops/projects/xlsx';

const MAX_UPLOAD_BYTES = 4_000_000;

export function assertUploadSize(size: number): void {
  if (size > MAX_UPLOAD_BYTES) {
    throw new ContactValidationError('This file is over 4MB. Save it as CSV and the importer will send it in batches.');
  }
}

export function tableFromUpload(filename: string, bytes: Buffer): { headers: string[]; rows: string[][] } {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.xlsx')) {
    const sheets = readXlsxSheets(bytes);
    const sheet = sheets[0];
    if (!sheet?.rows?.length) throw new ContactValidationError('The spreadsheet has no rows.');
    const [headers, ...rows] = sheet.rows;
    return { headers: headers.map((cell) => cell.trim()), rows: rows.filter((row) => row.some((cell) => cell.trim())) };
  }
  const text = bytes.toString('utf8');
  const parsed = parseCsv(text);
  if (!parsed.length) throw new ContactValidationError('The CSV file has no rows.');
  const [headers, ...rows] = parsed;
  return { headers, rows };
}

export function previewUpload(filename: string, bytes: Buffer) {
  assertUploadSize(bytes.length);
  const table = tableFromUpload(filename, bytes);
  const suggested = suggestMapping(table.headers);
  return {
    headers: table.headers,
    sample: table.rows.slice(0, 8),
    totalRows: table.rows.length,
    suggested,
  };
}

export function recordsFromUpload(
  filename: string,
  bytes: Buffer,
  mapping: Partial<Record<CanonicalField, string>>,
  extraPhones: string[] = [],
): Record<string, string>[] {
  assertUploadSize(bytes.length);
  const table = tableFromUpload(filename, bytes);
  return recordsFromTable(table.headers, table.rows, mapping, extraPhones);
}
