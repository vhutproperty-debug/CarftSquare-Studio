import { createHash } from 'node:crypto';
import { normalizeIndianMobile } from '@/lib/phone/indian-mobile';
import type { HousingApiLead } from '@/lib/ops/integrations/housing/housing.types';

export type HousingMappedLead = {
  externalLeadId: string;
  payload: Record<string, unknown>;
};

export class HousingMapperError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'HousingMapperError';
  }
}

function canonicalPart(value: unknown): string {
  if (value === undefined || value === null) return '';
  return String(value).trim().toLowerCase();
}

function canonicalPhone(lead: HousingApiLead): string {
  const raw = lead.lead_phone ?? lead.mobile ?? lead.phone ?? lead.contact_number;
  const normalized = normalizeIndianMobile(raw);
  if (normalized) return normalized;
  return canonicalPart(raw);
}

/**
 * Deterministic external id from stable Housing fields.
 * Prefer explicit Housing ids when present; otherwise SHA-256 of a canonical composite.
 * The hash never embeds raw PII in the returned id.
 */
export function buildHousingExternalLeadId(lead: HousingApiLead): string {
  const explicit = lead.lead_id ?? lead.leadId ?? lead.id;
  if (explicit !== undefined && explicit !== null && String(explicit).trim()) {
    return `housing_ext_${String(explicit).trim()}`;
  }

  const flatId = canonicalPart(lead.flat_id);
  const leadDate = canonicalPart(lead.lead_date);
  const phone = canonicalPhone(lead);
  const project = canonicalPart(lead.project_name ?? lead.project);

  if (!flatId && !leadDate && !phone && !project) {
    throw new HousingMapperError('Insufficient Housing fields to generate an external lead id.');
  }

  const digest = createHash('sha256')
    .update([flatId, leadDate, phone, project].join('|'))
    .digest('hex');

  return `housing_${digest.slice(0, 32)}`;
}

/** Validate and extract the external lead id + immutable raw payload reference. */
export function mapHousingApiLead(lead: HousingApiLead): HousingMappedLead {
  if (!lead || typeof lead !== 'object') {
    throw new HousingMapperError('Invalid Housing lead payload.');
  }

  return {
    externalLeadId: buildHousingExternalLeadId(lead),
    payload: { ...lead },
  };
}

export function mapHousingApiLeads(leads: HousingApiLead[]): HousingMappedLead[] {
  return leads.map(mapHousingApiLead);
}
