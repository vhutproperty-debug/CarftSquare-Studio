import { aurisSerenityAdapter } from '@/lib/ops/leads/adapters/auris-serenity';
import { designerCallbackAdapter } from '@/lib/ops/leads/adapters/designer-callback';
import { housingApiAdapter } from '@/lib/ops/leads/adapters/housing-api';
import { housingComAdapter } from '@/lib/ops/leads/adapters/housing-com';
import { homepageAdapter } from '@/lib/ops/leads/adapters/homepage';
import { paintingAdapter } from '@/lib/ops/leads/adapters/painting';
import { quotationAdapter } from '@/lib/ops/leads/adapters/quotation';
import { satelliteEleganceAdapter } from '@/lib/ops/leads/adapters/satellite-elegance';
import type { LeadSourceAdapter } from '@/lib/ops/leads/adapters/shared';
import type { OpsLeadSource } from '@/lib/ops/leads/types';

export const LEAD_SOURCE_ADAPTERS: LeadSourceAdapter[] = [
  homepageAdapter,
  paintingAdapter,
  aurisSerenityAdapter,
  satelliteEleganceAdapter,
  designerCallbackAdapter,
  quotationAdapter,
  housingComAdapter,
  housingApiAdapter,
];

export const LEAD_ADAPTER_BY_SOURCE: Record<OpsLeadSource, LeadSourceAdapter> = {
  homepage: homepageAdapter,
  painting: paintingAdapter,
  auris_serenity: aurisSerenityAdapter,
  satellite_elegance: satelliteEleganceAdapter,
  designer_callback: designerCallbackAdapter,
  quotation: quotationAdapter,
  housing_com: housingComAdapter,
  housing: housingApiAdapter,
};

export function getLeadAdapter(source: OpsLeadSource): LeadSourceAdapter {
  return LEAD_ADAPTER_BY_SOURCE[source];
}

export function resolveAdapters(source?: OpsLeadSource): LeadSourceAdapter[] {
  if (source) {
    return [getLeadAdapter(source)];
  }
  return LEAD_SOURCE_ADAPTERS;
}
