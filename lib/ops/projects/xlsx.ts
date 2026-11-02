import { inflateRawSync } from 'node:zlib';
import { ProjectValidationError } from '@/lib/ops/projects/errors';

function decodeXml(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function unzip(buffer: Buffer): Map<string, Buffer> {
  const files = new Map<string, Buffer>();
  let offset = 0;
  while (offset + 30 <= buffer.length) {
    const signature = buffer.readUInt32LE(offset);
    if (signature !== 0x04034b50) break;
    const method = buffer.readUInt16LE(offset + 8);
    const compressedSize = buffer.readUInt32LE(offset + 18);
    const nameLength = buffer.readUInt16LE(offset + 26);
    const extraLength = buffer.readUInt16LE(offset + 28);
    const nameStart = offset + 30;
    const name = buffer.subarray(nameStart, nameStart + nameLength).toString('utf8');
    const dataStart = nameStart + nameLength + extraLength;
    const compressed = buffer.subarray(dataStart, dataStart + compressedSize);
    if (method === 0) files.set(name, Buffer.from(compressed));
    else if (method === 8) files.set(name, inflateRawSync(compressed));
    else throw new ProjectValidationError('This spreadsheet uses a compression method the importer does not read.');
    offset = dataStart + compressedSize;
  }
  return files;
}

function textNodes(xml: string): string {
  const parts: string[] = [];
  const pattern = /<t\b[^>]*>([\s\S]*?)<\/t>/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(xml))) parts.push(decodeXml(match[1]));
  return parts.join('');
}

function sharedStrings(xml: string): string[] {
  const values: string[] = [];
  const pattern = /<si\b[^>]*>([\s\S]*?)<\/si>/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(xml))) values.push(textNodes(match[1]));
  return values;
}

function columnIndex(letters: string): number {
  let index = 0;
  for (const char of letters) index = index * 26 + (char.charCodeAt(0) - 64);
  return index - 1;
}

function sheetRows(xml: string, strings: string[]): string[][] {
  const rows: string[][] = [];
  const rowPattern = /<row\b[^>]*>([\s\S]*?)<\/row>/g;
  let rowMatch: RegExpExecArray | null;
  while ((rowMatch = rowPattern.exec(xml))) {
    const cells = new Map<number, string>();
    const cellPattern = /<c\b([^>]*)(?:\/>|>([\s\S]*?)<\/c>)/g;
    let cellMatch: RegExpExecArray | null;
    let width = 0;
    while ((cellMatch = cellPattern.exec(rowMatch[1]))) {
      const attrs = cellMatch[1];
      const body = cellMatch[2] || '';
      const ref = /r="([A-Z]+)\d+"/.exec(attrs);
      const type = /t="([^"]+)"/.exec(attrs)?.[1] || '';
      const column = ref ? columnIndex(ref[1]) : cells.size;
      let value = '';
      if (type === 'inlineStr') value = textNodes(body);
      else {
        const raw = /<v[^>]*>([\s\S]*?)<\/v>/.exec(body)?.[1];
        if (raw != null) {
          const decoded = decodeXml(raw);
          value = type === 's' ? (strings[Number(decoded)] || '') : decoded;
        }
      }
      cells.set(column, value);
      if (column > width) width = column;
    }
    const line: string[] = [];
    for (let index = 0; index <= width; index += 1) line.push(cells.get(index) || '');
    rows.push(line);
  }
  return rows;
}

function attr(source: string, name: string): string {
  const match = new RegExp(`${name}="([^"]*)"`).exec(source);
  return match ? decodeXml(match[1]) : '';
}

export type XlsxSheet = { name: string; rows: string[][] };

export function readXlsxSheets(bytes: Buffer): XlsxSheet[] {
  let files: Map<string, Buffer>;
  try {
    files = unzip(bytes);
  } catch (error) {
    if (error instanceof ProjectValidationError) throw error;
    throw new ProjectValidationError('The spreadsheet could not be read.');
  }
  const shared = files.get('xl/sharedStrings.xml');
  const strings = shared ? sharedStrings(shared.toString('utf8')) : [];
  const workbook = files.get('xl/workbook.xml')?.toString('utf8') || '';
  const rels = files.get('xl/_rels/workbook.xml.rels')?.toString('utf8') || '';
  const targets = new Map<string, string>();
  const relPattern = /<Relationship\b([^>]*)\/?>/g;
  let relMatch: RegExpExecArray | null;
  while ((relMatch = relPattern.exec(rels))) {
    const id = attr(relMatch[1], 'Id');
    const target = attr(relMatch[1], 'Target');
    if (id && target) targets.set(id, target.replace(/^\//, '').replace(/^\.\//, ''));
  }
  const sheets: XlsxSheet[] = [];
  const sheetPattern = /<sheet\b([^>]*)\/?>/g;
  let sheetMatch: RegExpExecArray | null;
  while ((sheetMatch = sheetPattern.exec(workbook))) {
    const name = attr(sheetMatch[1], 'name');
    const id = attr(sheetMatch[1], 'r:id');
    const target = targets.get(id) || '';
    const path = target.startsWith('xl/') ? target : `xl/${target}`;
    const xml = files.get(path);
    if (!name || !xml) continue;
    sheets.push({ name, rows: sheetRows(xml.toString('utf8'), strings) });
  }
  if (sheets.length) return sheets;
  const fallback = [...files.keys()].filter((name) => /^xl\/worksheets\/sheet\d+\.xml$/.test(name)).sort();
  fallback.forEach((path, index) => {
    const xml = files.get(path);
    if (!xml) return;
    sheets.push({ name: `Sheet ${index + 1}`, rows: sheetRows(xml.toString('utf8'), strings) });
  });
  if (!sheets.length) throw new ProjectValidationError('The spreadsheet has no worksheets.');
  return sheets;
}
