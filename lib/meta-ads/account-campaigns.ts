import { metaAdsGraph } from '@/lib/meta-ads/client';
import { getMetaAdsAdAccountId } from '@/lib/meta-ads/config';

export type LiveCampaign = {
  id: string;
  name: string;
  status: string;
  effectiveStatus: string;
  objective: string;
};

type CampaignNode = {
  id?: string;
  name?: string;
  status?: string;
  effective_status?: string;
  objective?: string;
};

export async function listAdAccountCampaigns(): Promise<LiveCampaign[]> {
  const act = getMetaAdsAdAccountId();
  if (!/^act_\d+$/.test(act)) {
    throw Object.assign(new Error('META_AD_ACCOUNT_ID is not a valid ad account id.'), { status: 400 });
  }
  const data = await metaAdsGraph<{ data?: CampaignNode[] }>(
    `/${act}/campaigns?fields=id,name,status,effective_status,objective&limit=100`,
  );
  return (data.data || []).flatMap((row) => {
    if (!row.id) return [];
    return [{
      id: String(row.id),
      name: row.name || 'Untitled campaign',
      status: row.status || '',
      effectiveStatus: row.effective_status || '',
      objective: row.objective || '',
    }];
  });
}
