import {
  getMetaAdsAccessToken,
  getMetaAdsGraphVersion,
} from '@/lib/meta-ads/config';
import { META_PERMISSION_PENDING_MESSAGE } from '@/lib/meta-ads/messages';

const PERMISSION_CODES = new Set([3, 10, 200, 294]);

export class MetaAdsApiError extends Error {
  status?: number;
  code?: number;
  raw?: unknown;
  permissionPending?: boolean;

  constructor(
    message: string,
    opts?: { status?: number; code?: number; raw?: unknown; permissionPending?: boolean },
  ) {
    super(message);
    this.name = 'MetaAdsApiError';
    this.status = opts?.status;
    this.code = opts?.code;
    this.raw = opts?.raw;
    this.permissionPending = opts?.permissionPending;
  }
}

type GraphErrorBody = {
  message?: string;
  code?: number;
  type?: string;
  error_subcode?: number;
};

function isPermissionGraphError(error: GraphErrorBody | undefined): boolean {
  if (!error) return false;
  if (error.code === 190) return false;
  if (typeof error.code === 'number' && PERMISSION_CODES.has(error.code)) return true;
  const message = (error.message || '').toLowerCase();
  return message.includes('permission') || message.includes('permissions');
}

export async function metaAdsGraph<T = Record<string, unknown>>(
  path: string,
  options?: {
    method?: 'GET' | 'POST' | 'DELETE';
    body?: Record<string, unknown>;
    /** Page token or other override. Defaults to the system user token. */
    token?: string;
  },
): Promise<T> {
  const token = options?.token?.trim() || getMetaAdsAccessToken();
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

  const json = (await response.json().catch(() => ({}))) as { error?: GraphErrorBody } & T;

  if (!response.ok || json.error) {
    const permissionPending = isPermissionGraphError(json.error);
    throw new MetaAdsApiError(
      permissionPending
        ? META_PERMISSION_PENDING_MESSAGE
        : json.error?.message || `Meta Graph HTTP ${response.status}`,
      {
        status: permissionPending ? 403 : response.status,
        code: json.error?.code,
        raw: json.error,
        permissionPending,
      },
    );
  }

  return json as T;
}
