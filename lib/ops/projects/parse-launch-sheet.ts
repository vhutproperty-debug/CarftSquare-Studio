import { ProjectValidationError } from '@/lib/ops/projects/errors';
import {
  normalizeDeveloperStatus,
  parseBhks,
  parseCarpet,
  parseCrores,
  parsePsf,
  slugify,
  splitSourceLinks,
} from '@/lib/ops/projects/format';
import type { XlsxSheet } from '@/lib/ops/projects/xlsx';
import type { DeveloperProject } from '@/lib/ops/projects/types';

export type LaunchDraft = Omit<DeveloperProject, 'id' | 'createdAt' | 'updatedAt' | 'lastUpdatedAt' | 'lastUpdatedBy'> & {
  slug: string;
};

function headerIndex(headers: string[]): Record<string, number> {
  const index: Record<string, number> = {};
  headers.forEach((header, position) => {
    index[header.trim().toLowerCase().replace(/\s+/g, ' ')] = position;
  });
  return index;
}

function cell(row: string[], index: Record<string, number>, key: string): string {
  const position = index[key];
  if (position == null) return '';
  return String(row[position] || '').trim();
}

export function draftsFromLaunchSheets(sheets: XlsxSheet[]): LaunchDraft[] {
  const drafts: LaunchDraft[] = [];
  const seen = new Set<string>();
  sheets.forEach((sheet) => {
    const headers = sheet.rows[0] || [];
    const index = headerIndex(headers);
    if (index.project == null || index.developer == null) {
      throw new ProjectValidationError(`The “${sheet.name}” sheet is missing Project or Developer columns.`);
    }
    sheet.rows.slice(1).forEach((row) => {
      const name = cell(row, index, 'project');
      if (!name) return;
      const slug = slugify(name);
      if (!slug || seen.has(slug)) return;
      seen.add(slug);
      const configLabel = cell(row, index, 'config & carpet');
      const priceLabel = cell(row, index, 'price');
      const carpet = parseCarpet(configLabel);
      const price = parseCrores(priceLabel);
      const psf = parsePsf(priceLabel);
      const statusLabel = cell(row, index, 'launch/status');
      drafts.push({
        slug,
        name,
        developer: cell(row, index, 'developer'),
        locality: sheet.name.trim(),
        address: cell(row, index, 'locality'),
        maharera: cell(row, index, 'maharera'),
        status: normalizeDeveloperStatus(statusLabel),
        statusLabel,
        configLabel,
        bhk: parseBhks(configLabel),
        carpetMinSqft: carpet.min,
        carpetMaxSqft: carpet.max,
        priceLabel,
        priceMinCrore: price.min,
        priceMaxCrore: price.max,
        pricePerSqft: psf.min,
        pricePerSqftMax: psf.max,
        possession: cell(row, index, 'possession'),
        inventoryNote: cell(row, index, 'inventory/sold'),
        offerNote: cell(row, index, 'cp / offer info'),
        channelPartnerStatus: 'not_approached',
        usps: [],
        amenities: [],
        floorPlans: [],
        brochureUrl: '',
        contacts: [],
        notes: '',
        sourceLinks: splitSourceLinks(cell(row, index, 'source url(s)')),
      });
    });
  });
  return drafts;
}
