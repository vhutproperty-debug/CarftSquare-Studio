import { MetaAdsApiError, metaAdsGraph } from '@/lib/meta-ads/client';
import { getMetaAdsAdAccountId, getMetaAdsBusinessId, getMetaAdsPageId } from '@/lib/meta-ads/config';
import { META_PERMISSION_PENDING_MESSAGE } from '@/lib/meta-ads/messages';

const CANONICAL_BUSINESS_ID = '1420297320045438';

const ACCOUNT_STATUS_LABELS: Record<number, string> = {
  1: 'Active',
  2: 'Disabled',
  3: 'Unsettled',
  7: 'Pending risk review',
  8: 'Pending settlement',
  9: 'In grace period',
  100: 'Pending closure',
  101: 'Closed',
};

export type AssetSource = 'owned' | 'client';

export type OwnedAdAccount = {
  id: string;
  name: string;
  accountStatus: number | null;
  accountStatusLabel: string;
  currency: string;
  configured: boolean;
  source: AssetSource;
};

export type OwnedPage = {
  id: string;
  name: string;
  fanCount: number | null;
  configured: boolean;
  source: AssetSource;
};

export type AssetRead<T> =
  | { ok: true; data: T[] }
  | { ok: false; error: string; permissionPending: boolean };

const BUSINESS_EDGES = [
  'owned_ad_accounts',
  'owned_pages',
  'client_ad_accounts',
  'client_pages',
] as const;

export type BusinessEdge = (typeof BUSINESS_EDGES)[number];

/**
 * Graph edge path. owned_* and client_* are edges, not fields on the Business node.
 */
export function businessEdgePath(businessId: string, edge: BusinessEdge, fields: string): string {
  if (!/^\d+$/.test(businessId)) {
    throw Object.assign(new Error('META_BUSINESS_ID is not a valid business id.'), { status: 400 });
  }
  if (fields.split(',').some((field) => (BUSINESS_EDGES as readonly string[]).includes(field))) {
    throw Object.assign(new Error(`${edge} must be requested as an edge, not a field.`), { status: 400 });
  }
  const params = new URLSearchParams({ fields, limit: '100' });
  return `/${businessId}/${edge}?${params.toString()}`;
}

/** Keep a full numeric business id. A short value is treated as truncated and replaced. */
export function resolveBusinessId(): string {
  const configured = getMetaAdsBusinessId();
  if (/^\d{15,17}$/.test(configured)) return configured;
  console.warn('[meta-business] business_id_rejected', {
    length: configured.length,
    using: CANONICAL_BUSINESS_ID,
  });
  return CANONICAL_BUSINESS_ID;
}

function edgeFailure(error: unknown): AssetRead<never> {
  if (error instanceof MetaAdsApiError && error.permissionPending) {
    return { ok: false, error: META_PERMISSION_PENDING_MESSAGE, permissionPending: true };
  }
  return {
    ok: false,
    error: error instanceof Error ? error.message : 'Meta request failed.',
    permissionPending: false,
  };
}

async function readEdge<T>(path: string, mapRow: (row: Record<string, unknown>) => T | null): Promise<AssetRead<T>> {
  try {
    const result = await metaAdsGraph<{ data?: Array<Record<string, unknown>> }>(path);
    const data = (result.data || []).flatMap((row) => {
      const mapped = mapRow(row);
      return mapped ? [mapped] : [];
    });
    return { ok: true, data };
  } catch (error) {
    console.warn('[meta-business] edge_failed', {
      path,
      message: error instanceof Error ? error.message : 'Meta request failed.',
    });
    return edgeFailure(error);
  }
}

function mergeReads<T extends { id: string }>(primary: AssetRead<T>, fallback: AssetRead<T>): AssetRead<T> {
  const primaryRows = primary.ok ? primary.data : [];
  const fallbackRows = fallback.ok ? fallback.data : [];
  if (primaryRows.length > 0 || fallbackRows.length > 0) {
    const seen = new Set<string>();
    const data = [...primaryRows, ...fallbackRows].filter((row) => {
      if (seen.has(row.id)) return false;
      seen.add(row.id);
      return true;
    });
    return { ok: true, data };
  }
  if (!primary.ok) return primary;
  if (!fallback.ok) return fallback;
  return primary;
}

/** business_management: owned ad accounts and Pages, with client edges as fallbacks. */
export async function readBusinessAssets() {
  const businessId = resolveBusinessId();
  const configuredAccountId = getMetaAdsAdAccountId();
  const configuredPageId = getMetaAdsPageId();
  const mapAccount = (source: AssetSource) => (row: Record<string, unknown>): OwnedAdAccount | null => {
    const id = String(row.id || '');
    if (!id) return null;
    const accountStatus = typeof row.account_status === 'number' ? row.account_status : null;
    return {
      id,
      name: String(row.name || id),
      accountStatus,
      accountStatusLabel: accountStatus != null
        ? (ACCOUNT_STATUS_LABELS[accountStatus] || `Status ${accountStatus}`)
        : 'Unknown',
      currency: String(row.currency || ''),
      configured: id === configuredAccountId,
      source,
    };
  };
  const mapPage = (source: AssetSource) => (row: Record<string, unknown>): OwnedPage | null => {
    const id = String(row.id || '');
    if (!id) return null;
    return {
      id,
      name: String(row.name || id),
      fanCount: typeof row.fan_count === 'number' ? row.fan_count : null,
      configured: id === configuredPageId,
      source,
    };
  };
  const [ownedAccounts, ownedPages] = await Promise.all([
    readEdge(
      businessEdgePath(businessId, 'owned_ad_accounts', 'id,name,account_status,currency'),
      mapAccount('owned'),
    ),
    readEdge(
      businessEdgePath(businessId, 'owned_pages', 'id,name,fan_count'),
      mapPage('owned'),
    ),
  ]);
  const [clientAccounts, clientPages] = await Promise.all([
    ownedAccounts.ok && ownedAccounts.data.length > 0
      ? Promise.resolve(ownedAccounts)
      : readEdge(
        businessEdgePath(businessId, 'client_ad_accounts', 'id,name,account_status,currency'),
        mapAccount('client'),
      ),
    ownedPages.ok && ownedPages.data.length > 0
      ? Promise.resolve(ownedPages)
      : readEdge(
        businessEdgePath(businessId, 'client_pages', 'id,name,fan_count'),
        mapPage('client'),
      ),
  ]);
  return {
    businessId,
    configuredAdAccountId: configuredAccountId,
    configuredPageId,
    adAccounts: mergeReads(ownedAccounts, clientAccounts),
    pages: mergeReads(ownedPages, clientPages),
  };
}
