import { MetaAdsApiError, metaAdsGraph } from '@/lib/meta-ads/client';
import { getMetaAdsAdAccountId, getMetaAdsBusinessId, getMetaAdsPageId } from '@/lib/meta-ads/config';
import { META_PERMISSION_PENDING_MESSAGE } from '@/lib/meta-ads/messages';

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

export type OwnedAdAccount = {
  id: string;
  name: string;
  accountStatus: number | null;
  accountStatusLabel: string;
  currency: string;
  configured: boolean;
};

export type OwnedPage = {
  id: string;
  name: string;
  configured: boolean;
};

export type AssetRead<T> =
  | { ok: true; data: T[] }
  | { ok: false; error: string; permissionPending: boolean };

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
    return edgeFailure(error);
  }
}

/** business_management: owned ad accounts and Pages for the configured business. */
export async function readBusinessAssets() {
  const businessId = getMetaAdsBusinessId();
  if (!/^\d+$/.test(businessId)) {
    throw Object.assign(new Error('META_BUSINESS_ID is not a valid business id.'), { status: 400 });
  }
  const configuredAccountId = getMetaAdsAdAccountId();
  const configuredPageId = getMetaAdsPageId();
  const [adAccounts, pages] = await Promise.all([
    readEdge<OwnedAdAccount>(
      `/${businessId}/owned_ad_accounts?fields=id,name,account_status,currency&limit=100`,
      (row) => {
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
        };
      },
    ),
    readEdge<OwnedPage>(
      `/${businessId}/owned_pages?fields=id,name&limit=100`,
      (row) => {
        const id = String(row.id || '');
        if (!id) return null;
        return {
          id,
          name: String(row.name || id),
          configured: id === configuredPageId,
        };
      },
    ),
  ]);
  return {
    businessId,
    configuredAdAccountId: configuredAccountId,
    configuredPageId,
    adAccounts,
    pages,
  };
}
