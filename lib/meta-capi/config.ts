import { META_PIXEL_ID } from '@/lib/meta-pixel-id';

const GRAPH_API_VERSION = 'v21.0';

export interface MetaCapiConfigStatus {
  enabled: boolean;
  pixelId: boolean;
  accessToken: boolean;
  testEventCode: boolean;
  missing: string[];
}

export function getMetaPixelIdServer(): string | null {
  return process.env.META_PIXEL_ID?.trim() || process.env.NEXT_PUBLIC_META_PIXEL_ID?.trim() || META_PIXEL_ID;
}

export function getMetaAccessToken(): string | null {
  return process.env.META_ACCESS_TOKEN?.trim() || null;
}

export function getMetaTestEventCode(): string | null {
  return process.env.META_TEST_EVENT_CODE?.trim() || null;
}

export function validateMetaCapiConfig(): MetaCapiConfigStatus {
  const pixelId = Boolean(getMetaPixelIdServer());
  const accessToken = Boolean(getMetaAccessToken());
  const testEventCode = Boolean(getMetaTestEventCode());
  const missing: string[] = [];

  if (!pixelId) missing.push('META_PIXEL_ID');
  if (!accessToken) missing.push('META_ACCESS_TOKEN');

  return {
    enabled: pixelId && accessToken,
    pixelId,
    accessToken,
    testEventCode,
    missing,
  };
}

export function isMetaCapiEnabled(): boolean {
  return validateMetaCapiConfig().enabled;
}

export function getMetaGraphEventsUrl(pixelId: string, accessToken: string): string {
  const params = new URLSearchParams({ access_token: accessToken });
  return `https://graph.facebook.com/${GRAPH_API_VERSION}/${pixelId}/events?${params.toString()}`;
}
