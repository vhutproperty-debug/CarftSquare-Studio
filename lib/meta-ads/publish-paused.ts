import { metaAdsGraph } from '@/lib/meta-ads/client';
import {
  getMetaAdsAdAccountId,
  getMetaAdsDefaultDailyBudgetInr,
  getMetaAdsPageId,
  getMetaAdsPixelId,
  isMetaAdsActiveSpendAllowed,
} from '@/lib/meta-ads/config';
import { getMetaAdsReadiness } from '@/lib/meta-ads/readiness';
import type { MetaAdsCampaignRecord, MetaAdsCreative } from '@/lib/meta-ads/types';

export type PublishPausedResult = {
  ok: boolean;
  metaCampaignId?: string;
  metaAdSetId?: string;
  metaCreativeId?: string;
  metaAdId?: string;
  metaLeadFormId?: string;
  error?: string;
};

/**
 * Publish a Lead campaign to Meta in PAUSED status only.
 * Refuses ACTIVE unless META_ADS_ALLOW_ACTIVE=true (still defaults to PAUSED here).
 */
export async function publishPausedLeadCampaign(input: {
  campaign: MetaAdsCampaignRecord;
  creative: MetaAdsCreative;
}): Promise<PublishPausedResult> {
  const readiness = await getMetaAdsReadiness();
  if (!readiness.canPublishPaused) {
    return {
      ok: false,
      error: readiness.blockers[0] || 'Cannot publish paused campaign — check /api/ops/ads/status',
    };
  }

  // Absolute safety: this module never activates spend in dry-run.
  if (isMetaAdsActiveSpendAllowed()) {
    // Even if unlocked later, this function still publishes PAUSED only.
  }
  const status = 'PAUSED' as const;

  const actId = getMetaAdsAdAccountId();
  const pageId = getMetaAdsPageId();
  const pixelId = getMetaAdsPixelId();
  const dailyBudgetInr = input.campaign.dailyBudgetInr || getMetaAdsDefaultDailyBudgetInr();
  const budgetMinor = String(Math.round(dailyBudgetInr * 100)); // INR paise

  try {
    const campaignRes = await metaAdsGraph<{ id: string }>(`/${actId}/campaigns`, {
      method: 'POST',
      body: {
        name: input.campaign.name,
        objective: 'OUTCOME_LEADS',
        status,
        special_ad_categories: [],
        is_adset_budget_sharing_enabled: false,
      },
    });

    // Prefer Instant Form destination when page forms are available; else website+pixel lead.
    let leadFormId: string | undefined;
    try {
      const forms = await metaAdsGraph<{ data?: Array<{ id: string; name?: string; status?: string }> }>(
        `/${pageId}/leadgen_forms?fields=id,name,status&limit=25`,
      );
      const active = (forms.data || []).find((f) => (f.status || '').toUpperCase() === 'ACTIVE')
        || (forms.data || [])[0];
      leadFormId = active?.id;
    } catch {
      // Page token scope may be missing — fall back to website lead object.
    }

    const useInstantForm = Boolean(leadFormId);
    const geoCities = input.campaign.areas?.length
      ? undefined
      : undefined;

    const targeting: Record<string, unknown> = {
      geo_locations: {
        countries: ['IN'],
        cities: [
          {
            key: '1010721', // Mumbai geo key commonly used; Meta may remap
            name: 'Mumbai',
            radius: 25,
            distance_unit: 'kilometer',
          },
        ],
      },
      age_min: 25,
      age_max: 55,
    };

    // Keep geo simple if city key fails on some tokens — countries only fallback handled below.
    void geoCities;

    const adSetBody: Record<string, unknown> = {
      name: `${input.campaign.name} — Ad set`,
      campaign_id: campaignRes.id,
      status,
      daily_budget: budgetMinor,
      billing_event: 'IMPRESSIONS',
      optimization_goal: 'LEAD_GENERATION',
      bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
      targeting,
      dsa_beneficiary: 'CraftSquare Properties',
      dsa_payor: 'CraftSquare Properties',
    };

    if (useInstantForm && leadFormId) {
      adSetBody.promoted_object = {
        page_id: pageId,
        lead_gen_form_id: leadFormId,
      };
      adSetBody.destination_type = 'ON_AD';
    } else {
      adSetBody.promoted_object = {
        pixel_id: pixelId,
        custom_event_type: 'LEAD',
      };
      adSetBody.destination_type = 'WEBSITE';
    }

    let adSetRes: { id: string };
    try {
      adSetRes = await metaAdsGraph<{ id: string }>(`/${actId}/adsets`, {
        method: 'POST',
        body: adSetBody,
      });
    } catch (firstError) {
      // Retry with India-only geo if Mumbai city key rejected.
      adSetBody.targeting = {
        geo_locations: { countries: ['IN'] },
        age_min: 25,
        age_max: 55,
      };
      try {
        adSetRes = await metaAdsGraph<{ id: string }>(`/${actId}/adsets`, {
          method: 'POST',
          body: adSetBody,
        });
      } catch {
        throw firstError;
      }
    }

    const linkUrl = 'https://craftsquare.co.in/free-interior-consultation';
    const message = input.creative.primaryText;
    const objectStorySpec = useInstantForm && leadFormId
      ? {
          page_id: pageId,
          link_data: {
            message,
            name: input.creative.headline,
            description: input.creative.description,
            link: linkUrl,
            call_to_action: {
              type: input.creative.cta || 'SIGN_UP',
              value: { lead_gen_form_id: leadFormId },
            },
          },
        }
      : {
          page_id: pageId,
          link_data: {
            message,
            name: input.creative.headline,
            description: input.creative.description,
            link: linkUrl,
            call_to_action: {
              type: input.creative.cta || 'LEARN_MORE',
              value: { link: linkUrl },
            },
          },
        };

    const creativeRes = await metaAdsGraph<{ id: string }>(`/${actId}/adcreatives`, {
      method: 'POST',
      body: {
        name: `Creative — ${input.creative.headline}`,
        object_story_spec: objectStorySpec,
      },
    });

    const adRes = await metaAdsGraph<{ id: string }>(`/${actId}/ads`, {
      method: 'POST',
      body: {
        name: `${input.campaign.name} — Ad`,
        adset_id: adSetRes.id,
        creative: { creative_id: creativeRes.id },
        status,
      },
    });

    return {
      ok: true,
      metaCampaignId: campaignRes.id,
      metaAdSetId: adSetRes.id,
      metaCreativeId: creativeRes.id,
      metaAdId: adRes.id,
      metaLeadFormId: leadFormId,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Failed to publish paused Meta campaign.',
    };
  }
}
