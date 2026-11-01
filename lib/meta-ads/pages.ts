import { MetaAdsApiError, metaAdsGraph } from '@/lib/meta-ads/client';
import { getMetaAdsPageId } from '@/lib/meta-ads/config';
import { META_PERMISSION_PENDING_MESSAGE } from '@/lib/meta-ads/messages';

export type PageLeadForm = {
  id: string;
  name: string;
  status: string;
};

export type AccessiblePage = {
  id: string;
  name: string;
  category: string;
  fanCount: number | null;
  leadForms: PageLeadForm[];
  leadFormsError?: string;
  permissionPending: boolean;
  configured: boolean;
};

type AccountRow = {
  id?: string;
  name?: string;
  category?: string;
  fan_count?: number;
  access_token?: string;
};

function permissionMessage(error: unknown): string | null {
  if (error instanceof MetaAdsApiError && error.permissionPending) return META_PERMISSION_PENDING_MESSAGE;
  return null;
}

async function readPageDetails(pageId: string, token?: string) {
  const [detailResult, formsResult] = await Promise.allSettled([
    metaAdsGraph<{ name?: string; fan_count?: number }>(
      `/${pageId}?fields=name,fan_count`,
      token ? { token } : undefined,
    ),
    metaAdsGraph<{ data?: Array<{ id?: string; name?: string; status?: string }> }>(
      `/${pageId}/leadgen_forms?fields=id,name,status&limit=50`,
      token ? { token } : undefined,
    ),
  ]);

  let name: string | undefined;
  let fanCount: number | null = null;
  let permissionPending = false;
  let detailError: string | undefined;
  if (detailResult.status === 'fulfilled') {
    name = detailResult.value.name;
    fanCount = typeof detailResult.value.fan_count === 'number' ? detailResult.value.fan_count : null;
  } else {
    const pending = permissionMessage(detailResult.reason);
    if (pending) permissionPending = true;
    else detailError = detailResult.reason instanceof Error ? detailResult.reason.message : 'Unable to read the Page.';
  }

  let leadForms: PageLeadForm[] = [];
  let leadFormsError: string | undefined;
  if (formsResult.status === 'fulfilled') {
    leadForms = (formsResult.value.data || []).flatMap((form) => {
      if (!form.id) return [];
      return [{
        id: String(form.id),
        name: form.name || 'Untitled form',
        status: form.status || '',
      }];
    });
  } else {
    const pending = permissionMessage(formsResult.reason);
    if (pending) {
      permissionPending = true;
      leadFormsError = pending;
    } else {
      leadFormsError = formsResult.reason instanceof Error
        ? formsResult.reason.message
        : 'Unable to read lead forms.';
    }
  }

  return { name, fanCount, leadForms, leadFormsError, permissionPending, detailError };
}

/**
 * pages_show_list via /me/accounts, then pages_read_engagement for fan count and lead forms.
 * Page access tokens from the list are used for the follow-up reads and never returned.
 */
export async function listAccessiblePages(): Promise<AccessiblePage[]> {
  const configuredPageId = getMetaAdsPageId();
  const listed = await metaAdsGraph<{ data?: AccountRow[] }>(
    '/me/accounts?fields=id,name,category,fan_count,access_token&limit=100',
  );
  const rows = (listed.data || []).filter((row) => row.id);
  const pages = await Promise.all(rows.map(async (row) => {
    const id = String(row.id);
    const details = await readPageDetails(id, row.access_token);
    const fanCount = details.fanCount != null
      ? details.fanCount
      : (typeof row.fan_count === 'number' ? row.fan_count : null);
    return {
      id,
      name: details.name || row.name || id,
      category: row.category || '',
      fanCount,
      leadForms: details.leadForms,
      leadFormsError: details.leadFormsError || details.detailError,
      permissionPending: details.permissionPending,
      configured: id === configuredPageId,
    };
  }));
  return pages;
}
