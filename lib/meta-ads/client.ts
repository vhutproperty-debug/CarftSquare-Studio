import {
  getMetaAdsAccessToken,
  getMetaAdsGraphVersion,
} from '@/lib/meta-ads/config';

export class MetaAdsApiError extends Error {
  status?: number;
  code?: number;
  raw?: unknown;

  constructor(message: string, opts?: { status?: number; code?: number; raw?: unknown }) {
    super(message);
    this.name = 'MetaAdsApiError';
    this.status = opts?.status;
    this.code = opts?.code;
    this.raw = opts?.raw;
  }
}

export async function metaAdsGraph<T = Record<string, unknown>>(
  path: string,
  options?: { method?: 'GET' | 'POST' | 'DELETE'; body?: Record<string, unknown> },
): Promise<T> {
  const token = getMetaAdsAccessToken();
  if (!token) {
    throw new MetaAdsApiError('META_ADS_ACCESS_TOKEN / META_ACCESS_TOKEN is not configured.', {
      status: 503,
    });
  }

  const version = getMetaAdsGraphVersion();
  const method = options?.method || 'GET';
  const sep = path.includes('?') ? '&' : '?';
  const url = `https://graph.facebook.com/${version}${path}${sep}access_token=${encodeURIComponent(token)}`;

  const response = await fetch(url, {
    method,
    headers: options?.body ? { 'Content-Type': 'application/json' } : undefined,
    body: options?.body ? JSON.stringify(options.body) : undefined,
  });

  const json = (await response.json().catch(() => ({}))) as {
    error?: { message?: string; code?: number };
  } & T;

  if (!response.ok || json.error) {
    throw new MetaAdsApiError(json.error?.message || `Meta Graph HTTP ${response.status}`, {
      status: response.status,
      code: json.error?.code,
      raw: json.error,
    });
  }

  return json as T;
}
