import { metaAdsGraph, MetaAdsApiError } from '@/lib/meta-ads/client';
import {
  getMetaAdsAccessToken,
  getMetaAdsAdAccountId,
  getMetaAdsBusinessId,
  getMetaAdsPageId,
  getMetaAdsPixelId,
  getMetaAdsGraphVersion,
  isMetaAdsActiveSpendAllowed,
} from '@/lib/meta-ads/config';
import type { MetaAdsReadiness } from '@/lib/meta-ads/types';

export async function getMetaAdsReadiness(): Promise<MetaAdsReadiness> {
  const blockers: string[] = [];
  const warnings: string[] = [];
  const tokenConfigured = Boolean(getMetaAdsAccessToken());
  const permissions: string[] = [];

  if (!tokenConfigured) {
    blockers.push('No Meta access token configured (set META_ADS_ACCESS_TOKEN for Marketing API).');
  }

  if (tokenConfigured) {
    try {
      const perms = await metaAdsGraph<{ data?: Array<{ permission: string; status: string }> }>(
        '/me/permissions',
      );
      for (const row of perms.data || []) {
        if (row.status === 'granted') permissions.push(row.permission);
      }
    } catch (error) {
      warnings.push(
        error instanceof MetaAdsApiError
          ? `Could not read permissions: ${error.message}`
          : 'Could not read token permissions.',
      );
    }
  }

  const hasAdsManagement = permissions.includes('ads_management');
  const hasAdsRead = permissions.includes('ads_read') || hasAdsManagement;

  if (tokenConfigured && !hasAdsManagement) {
    blockers.push(
      'Token is missing ads_management. Current token looks CAPI/dataset-only. Create a System User token with ads_management + ads_read + pages_manage_ads + leads_retrieval.',
    );
  }

  // Soft checks for assets
  if (tokenConfigured && hasAdsManagement) {
    try {
      await metaAdsGraph(`/${getMetaAdsAdAccountId()}?fields=id,name,account_status,currency`);
    } catch (error) {
      blockers.push(
        error instanceof MetaAdsApiError
          ? `Ad account not accessible: ${error.message}`
          : 'Ad account not accessible with this token.',
      );
    }
    try {
      await metaAdsGraph(`/${getMetaAdsPageId()}?fields=id,name`);
    } catch (error) {
      warnings.push(
        error instanceof MetaAdsApiError
          ? `Page check failed: ${error.message}`
          : 'Page check failed.',
      );
    }
  }

  const activeSpendAllowed = isMetaAdsActiveSpendAllowed();
  if (activeSpendAllowed) {
    warnings.push('META_ADS_ALLOW_ACTIVE=true — Active spend is unlocked. Keep false for dry-run.');
  } else {
    warnings.push('Dry-run mode: all publishes force status=PAUSED. No spend.');
  }

  return {
    dryRunOnly: true,
    activeSpendAllowed,
    tokenConfigured,
    businessId: getMetaAdsBusinessId(),
    adAccountId: getMetaAdsAdAccountId(),
    pageId: getMetaAdsPageId(),
    pixelId: getMetaAdsPixelId(),
    graphApiVersion: getMetaAdsGraphVersion(),
    permissions,
    hasAdsManagement,
    hasAdsRead,
    canPublishPaused: tokenConfigured && hasAdsManagement && blockers.length === 0,
    blockers,
    warnings,
  };
}
