import { normalizeIndianMobile } from '@/lib/phone/indian-mobile';
import type { NormalizedOpsLead, OpsLeadCategory } from '@/lib/ops/leads/types';

export function normalizeSearchTerm(search?: string): string {
  return search?.trim().toLowerCase() || '';
}

export function normalizePhoneSearchTerm(search?: string): string {
  return normalizeIndianMobile(search);
}

export function matchesLeadSearch(lead: NormalizedOpsLead, search?: string): boolean {
  const q = normalizeSearchTerm(search);
  if (!q) return true;

  const phoneDigits = normalizePhoneSearchTerm(search);
  const haystack = [
    lead.name,
    lead.phone,
    lead.email,
    lead.projectName,
    lead.intent,
    lead.requirement,
    lead.location,
    lead.budget != null ? String(lead.budget) : '',
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (haystack.includes(q)) return true;

  if (phoneDigits.length >= 4 && lead.phone) {
    const leadDigits = normalizeIndianMobile(lead.phone);
    if (leadDigits.includes(phoneDigits)) return true;
  }

  return false;
}

export function buildDateRangeQuery(dateFrom?: string, dateTo?: string): Record<string, unknown> {
  if (!dateFrom && !dateTo) return {};
  const range: Record<string, string> = {};
  if (dateFrom) range.$gte = dateFrom;
  if (dateTo) range.$lte = dateTo;
  return { createdAt: range };
}

export function inferCategoryFromService(service?: string): OpsLeadCategory {
  const value = String(service || '').toLowerCase();
  if (value.includes('paint')) return 'painting';
  if (value.includes('rental')) return 'rental';
  if (value.includes('interior') || value.includes('kitchen') || value.includes('wardrobe')) {
    return 'interior';
  }
  return 'general';
}

export function campaignIntentCategory(intent?: string): OpsLeadCategory {
  const value = String(intent || '').toLowerCase();
  if (value.includes('rental')) return 'rental';
  if (value.includes('furnish') || value.includes('interior') || value.includes('kitchen')) {
    return 'interior';
  }
  return 'unknown';
}

export function quotationCategory(moduleId?: string, projectCategory?: string): OpsLeadCategory {
  const combined = `${moduleId || ''} ${projectCategory || ''}`.toLowerCase();
  if (combined.includes('rental')) return 'rental';
  if (combined.includes('paint')) return 'painting';
  if (combined.includes('kitchen') || combined.includes('wardrobe') || combined.includes('interior')) {
    return 'interior';
  }
  return 'quotation';
}

export function pickSafeSummary(
  fields: Record<string, unknown>,
  allowedKeys: string[],
): Record<string, unknown> {
  const summary: Record<string, unknown> = {};
  for (const key of allowedKeys) {
    const value = fields[key];
    if (value === undefined || value === null || value === '') continue;
    if (typeof value === 'object' && !Array.isArray(value)) {
      summary[key] = value;
    } else {
      summary[key] = value;
    }
  }
  return summary;
}

export function sortLeadsNewestFirst(leads: NormalizedOpsLead[]): NormalizedOpsLead[] {
  return [...leads].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}
