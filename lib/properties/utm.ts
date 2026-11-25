import type { PropertiesUtmParams } from './types';

const UTM_KEYS = [
  ['utm_source', 'utmSource'],
  ['utm_medium', 'utmMedium'],
  ['utm_campaign', 'utmCampaign'],
  ['utm_term', 'utmTerm'],
  ['utm_content', 'utmContent'],
] as const;

export function captureUtmFromSearch(search: string): PropertiesUtmParams {
  const params = new URLSearchParams(search);
  const utm: PropertiesUtmParams = {};
  for (const [queryKey, fieldKey] of UTM_KEYS) {
    const value = params.get(queryKey)?.trim();
    if (value) utm[fieldKey] = value.slice(0, 120);
  }
  return utm;
}
