import { normalizeIndianMobile } from '@/lib/phone/indian-mobile';
import type { HousingApiLead, HousingNormalizedDemand } from '@/lib/ops/integrations/housing/housing.types';
import { HOUSING_SOURCE } from '@/lib/ops/integrations/housing/housing.types';

function pickString(...values: unknown[]): string | null {
  for (const value of values) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      const joined = value.map((item) => String(item).trim()).filter(Boolean).join(', ');
      if (joined) return joined;
      continue;
    }
    const text = String(value).trim();
    if (text) return text;
  }
  return null;
}

function formatRange(min: unknown, max: unknown): string | null {
  const minText = pickString(min);
  const maxText = pickString(max);
  if (minText && maxText) {
    if (minText === maxText) return minText;
    return `${minText}-${maxText}`;
  }
  return maxText || minText;
}

function normalizeBuyRent(lead: HousingApiLead): string | null {
  return pickString(lead.service_type, lead.buy_rent, lead.requirement_type, lead.intent);
}

/**
 * Convert Housing lead_date (unix seconds/ms or ISO string) to ISO.
 * Invalid individual dates return null — never throw.
 */
export function normalizeHousingLeadDate(raw: unknown): string | null {
  if (raw === undefined || raw === null || raw === '') return null;

  if (typeof raw === 'number' || (typeof raw === 'string' && /^\d+(\.\d+)?$/.test(raw.trim()))) {
    const numeric = typeof raw === 'number' ? raw : Number(raw.trim());
    if (!Number.isFinite(numeric)) return null;
    // Heuristic: values above 1e12 are milliseconds; otherwise treat as seconds.
    const ms = numeric > 1e12 ? numeric : numeric * 1000;
    const parsed = new Date(ms);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed.toISOString();
  }

  try {
    const parsed = new Date(String(raw));
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed.toISOString();
  } catch {
    return null;
  }
}

function buildMessage(lead: HousingApiLead): string | null {
  const parts = [
    pickString(lead.apartment_names),
    pickString(lead.property_field),
    pickString(lead.message, lead.remarks),
  ].filter(Boolean);
  return parts.length ? parts.join(' · ') : null;
}

/** Map Housing API fields into the unified demand model. Unknown fields remain in raw payload only. */
export function normalizeHousingDemand(
  externalLeadId: string,
  rawReferenceId: string,
  lead: HousingApiLead,
): HousingNormalizedDemand {
  const phoneRaw = pickString(lead.lead_phone, lead.mobile, lead.phone, lead.contact_number);
  const mobile = normalizeIndianMobile(phoneRaw || undefined) || phoneRaw;

  return {
    externalLeadId,
    source: HOUSING_SOURCE,
    customerName: pickString(lead.lead_name, lead.customer_name, lead.customerName, lead.name),
    mobile,
    email: pickString(lead.lead_email, lead.email)?.toLowerCase() || null,
    propertyType: pickString(lead.category_type, lead.property_type, lead.propertyType),
    project: pickString(lead.project_name, lead.project),
    locality: pickString(lead.locality_name, lead.locality, lead.location),
    city: pickString(lead.city_name),
    budget: formatRange(lead.min_price, lead.max_price) || pickString(lead.budget),
    area: formatRange(lead.min_area, lead.max_area),
    configuration: pickString(lead.property_field, lead.configuration, lead.bhk, lead.apartment_names),
    buyRent: normalizeBuyRent(lead),
    message: buildMessage(lead),
    leadDate: normalizeHousingLeadDate(lead.lead_date ?? lead.created_at ?? lead.createdAt),
    assignedTo: pickString(lead.assigned_to, lead.assignedTo),
    status: pickString(lead.status),
    rawReferenceId,
  };
}
