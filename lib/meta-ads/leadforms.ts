import { metaAdsGraph } from '@/lib/meta-ads/client';
import { getMetaAdsPageId, isMetaAdsPublishEnabled } from '@/lib/meta-ads/config';

export async function listLeadForms() {
  const pageId = getMetaAdsPageId();
  return metaAdsGraph<{ data?: Array<{ id: string; name?: string; status?: string }> }>(
    `/${pageId}/leadgen_forms?fields=id,name,status&limit=50`,
  );
}

export async function createLeadForm(input: { name: string }) {
  if (!isMetaAdsPublishEnabled()) {
    throw Object.assign(new Error('META_ADS_ENABLED is false. Lead form creation stays off.'), { status: 409 });
  }
  const pageId = getMetaAdsPageId();
  return metaAdsGraph<{ id: string }>(`/${pageId}/leadgen_forms`, {
    method: 'POST',
    body: {
      name: input.name,
      privacy_policy: { url: 'https://craftsquare.co.in/privacy-policy' },
      follow_up_action_url: 'https://craftsquare.co.in/ops/leads',
      questions: [
        { type: 'FULL_NAME' },
        { type: 'PHONE' },
        { type: 'EMAIL' },
      ],
    },
  });
}
