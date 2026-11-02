import salesContactSeed from '@/data/ops/project-sales-contacts.json';
import { splitSourceLinks } from '@/lib/ops/projects/format';
import type { SalesOfficeField } from '@/lib/ops/projects/types';

export type SalesContactSeedRow = {
  project: string;
  developer: string;
  location: string;
  sales_email: string;
  cp_email: string;
  sales_phone: string;
  source_url: string;
};

export const SALES_CONTACT_SEED = salesContactSeed as SalesContactSeedRow[];

export function projectNameKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function sameProjectName(left: string, right: string): boolean {
  const a = projectNameKey(left);
  const b = projectNameKey(right);
  if (!a || !b) return false;
  return a === b || a.startsWith(`${b} `) || b.startsWith(`${a} `);
}

export function localityFromAddress(location: string): string {
  const value = location.toLowerCase();
  if (value.includes('andheri')) return 'Andheri West';
  if (value.includes('goregaon')) return 'Goregaon West';
  return location.trim();
}

/** Public desk details start unverified until someone on the team checks them. */
export function classifySalesField(raw: string): SalesOfficeField {
  const trimmed = raw.trim();
  if (!trimmed || trimmed === '—' || trimmed === '-' || /^not found$/i.test(trimmed)) {
    return { value: '', verification: 'unverified', note: 'Unverified. Not found in the public source.' };
  }
  if (/^not found\b/i.test(trimmed)) {
    const general = /general:\s*([^)]+)/i.exec(trimmed);
    return {
      value: general ? general[1].trim() : '',
      verification: 'unverified',
      note: general
        ? 'Unverified. A project desk was not listed, so this is only the company general inbox.'
        : 'Unverified. Not found in the public source.',
    };
  }
  return {
    value: trimmed,
    verification: 'unverified',
    note: 'Unverified. Copied from the public source and not yet checked by the team.',
  };
}

export function salesFieldsFromSeed(row: SalesContactSeedRow) {
  return {
    salesEmail: classifySalesField(row.sales_email),
    cpEmail: classifySalesField(row.cp_email),
    salesPhone: classifySalesField(row.sales_phone),
    sourceLinks: splitSourceLinks(row.source_url).filter((link) => link.startsWith('http')),
  };
}
