import { MetaAdsApiError, metaAdsGraph } from '@/lib/meta-ads/client';
import { getMetaAdsPageId } from '@/lib/meta-ads/config';
import { getMetaPageAccessToken } from '@/lib/meta/config';

const PAGE_ID_PATTERN = /^\d+$/;

export function assertPageId(pageId: string): string {
  const id = pageId.trim();
  if (!PAGE_ID_PATTERN.test(id)) {
    throw Object.assign(new Error('Page id is not valid.'), { status: 400 });
  }
  return id;
}

/**
 * Page token for subscribed_apps. Prefer the token Graph returns for this Page
 * from /me/accounts (system user), then META_PAGE_ACCESS_TOKEN / META_LEAD_ADS_PAGE_TOKEN.
 */
export async function resolvePageAccessToken(pageId: string): Promise<string> {
  const id = assertPageId(pageId);
  let permissionError: MetaAdsApiError | null = null;
  try {
    const listed = await metaAdsGraph<{ data?: Array<{ id?: string; access_token?: string }> }>(
      '/me/accounts?fields=id,access_token&limit=100',
    );
    const match = (listed.data || []).find((row) => row.id === id && row.access_token);
    if (match?.access_token) return match.access_token;
  } catch (error) {
    if (error instanceof MetaAdsApiError && error.permissionPending) permissionError = error;
  }
  const configured = getMetaPageAccessToken();
  if (configured) return configured;
  if (permissionError) throw permissionError;
  throw new MetaAdsApiError(
    'Page access token is not available. Assign the Page to the system user.',
    { status: 503 },
  );
}

export type PageSubscriptionApp = {
  id: string;
  name: string;
  subscribedFields: string[];
};

export async function getPageLeadSubscription(pageId = getMetaAdsPageId()) {
  const id = assertPageId(pageId);
  const token = await resolvePageAccessToken(id);
  const result = await metaAdsGraph<{
    data?: Array<{ id?: string; name?: string; subscribed_fields?: string[] }>;
  }>(`/${id}/subscribed_apps`, { token });
  const apps: PageSubscriptionApp[] = (result.data || []).flatMap((app) => {
    if (!app.id) return [];
    return [{
      id: String(app.id),
      name: String(app.name || ''),
      subscribedFields: Array.isArray(app.subscribed_fields) ? app.subscribed_fields.map(String) : [],
    }];
  });
  return {
    pageId: id,
    leadgenSubscribed: apps.some((app) => app.subscribedFields.includes('leadgen')),
    apps,
  };
}

export async function subscribePageToLeadgen(pageId = getMetaAdsPageId()) {
  const id = assertPageId(pageId);
  const token = await resolvePageAccessToken(id);
  return metaAdsGraph<{ success?: boolean }>(
    `/${id}/subscribed_apps?subscribed_fields=leadgen`,
    { method: 'POST', token },
  );
}

export async function unsubscribePageFromLeadgen(pageId = getMetaAdsPageId()) {
  const id = assertPageId(pageId);
  const token = await resolvePageAccessToken(id);
  return metaAdsGraph<{ success?: boolean }>(`/${id}/subscribed_apps`, {
    method: 'DELETE',
    token,
  });
}
