import type { AurisUtmParams } from './types';

const UTM_KEYS = [
  ['utm_source', 'utmSource'],
  ['utm_medium', 'utmMedium'],
  ['utm_campaign', 'utmCampaign'],
  ['utm_term', 'utmTerm'],
  ['utm_content', 'utmContent'],
] as const;

export function captureUtmFromSearchParams(searchParams: URLSearchParams): AurisUtmParams {
  const utm: AurisUtmParams = {};

  for (const [queryKey, fieldKey] of UTM_KEYS) {
    const value = searchParams.get(queryKey)?.trim();
    if (value) utm[fieldKey] = value;
  }

  return utm;
}

export function captureUtmFromWindow(): AurisUtmParams {
  if (typeof window === 'undefined') return {};
  return captureUtmFromSearchParams(new URLSearchParams(window.location.search));
}
