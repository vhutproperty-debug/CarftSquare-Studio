import { metaAdsGraph } from '@/lib/meta-ads/client';
import { getMetaAdsPageId } from '@/lib/meta-ads/config';
import { isMetaLeadsEnabled } from '@/lib/meta/config';

export async function getPageLeadSubscription() {
  const pageId = getMetaAdsPageId();
  return metaAdsGraph<{ data?: Array<{ id?: string; name?: string; subscribed_fields?: string[] }> }>(
    `/${pageId}/subscribed_apps`,
  );
}

export async function subscribePageToLeadgen() {
  if (!isMetaLeadsEnabled()) {
    throw Object.assign(new Error('META_LEADS_ENABLED is false.'), { status: 409 });
  }
  const pageId = getMetaAdsPageId();
  return metaAdsGraph(`/${pageId}/subscribed_apps`, {
    method: 'POST',
    body: { subscribed_fields: 'leadgen' },
  });
}
