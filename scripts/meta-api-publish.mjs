/**
 * Meta Marketing API — CraftSquare campaign recover/create/publish
 * Token via META_ACCESS_TOKEN env only (never commit).
 */
const API = 'v21.0';
const TOKEN = process.env.META_ACCESS_TOKEN;
const PIXEL_ID = '1340743388120075';
const CAMPAIGN_NAMES = [
  'CraftSquare – Free Interior Consultation – Mumbai',
  'CraftSquare - Free Interior Consultation - Mumbai',
];
const LANDING_URL = 'https://craftsquare.co.in/free-interior-consultation';
const AUDIENCE_SEARCH = 'Mumbai Home owners';
const DAILY_BUDGET_INR = 700; // ₹700/day → paise for INR API

const report = {
  status: 'NOT_PUBLISHED',
  facebookProfile: null,
  businessManagerId: null,
  adAccountId: null,
  campaignId: null,
  adSetId: null,
  adId: null,
  budget: '₹700/day',
  pixel: PIXEL_ID,
  landingPage: LANDING_URL,
  audience: 'meta_audience_Mumbai Home owners.csv',
  checks: [],
  warnings: [],
  errors: [],
};

function norm(s = '') {
  return s.replace(/[–—-]/g, '-').replace(/\s+/g, ' ').trim().toLowerCase();
}

function matchesCampaign(name) {
  const n = norm(name);
  return CAMPAIGN_NAMES.some((c) => norm(c) === n)
    || (n.includes('craftsquare') && n.includes('free interior consultation') && n.includes('mumbai'));
}

async function graph(path, { method = 'GET', body } = {}) {
  const sep = path.includes('?') ? '&' : '?';
  const url = `https://graph.facebook.com/${API}${path}${sep}access_token=${encodeURIComponent(TOKEN)}`;
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  if (!res.ok || json.error) {
    const err = new Error(json.error?.message || res.statusText);
    err.code = json.error?.code;
    err.subcode = json.error?.error_subcode;
    err.raw = json.error;
    throw err;
  }
  return json;
}

async function main() {
  if (!TOKEN) throw new Error('META_ACCESS_TOKEN required');

  // Step 1 — verify access
  const me = await graph('/me?fields=id,name');
  report.facebookProfile = { id: me.id, name: me.name };
  report.checks.push(`Profile: ${me.name} (${me.id})`);

  const perms = await graph('/me/permissions');
  const granted = (perms.data || []).filter((p) => p.status === 'granted').map((p) => p.permission);
  report.checks.push(`Permissions: ${granted.join(', ') || 'none'}`);
  if (!granted.includes('ads_management')) {
    report.errors.push('Token missing ads_management permission');
  }

  const pixel = await graph(`/${PIXEL_ID}?fields=id,name,is_unavailable,owner_business`);
  report.checks.push(`Pixel ${PIXEL_ID}: ${pixel.name || 'ok'}`);
  if (pixel.is_unavailable) report.warnings.push('Pixel marked unavailable');
  if (pixel.owner_business?.id) report.businessManagerId = pixel.owner_business.id;

  let businesses = [];
  try {
    const biz = await graph('/me/businesses?fields=id,name&limit=50');
    businesses = biz.data || [];
  } catch (e) {
    report.warnings.push(`Businesses list: ${e.message}`);
  }

  const accounts = await graph(
    '/me/adaccounts?fields=id,account_id,name,account_status,business_name,currency,timezone_name&limit=100',
  );
  const adAccounts = accounts.data || [];
  if (!adAccounts.length) {
    report.errors.push('No ad accounts accessible');
    printReport();
    process.exit(1);
  }

  const craftAccount =
    adAccounts.find((a) => /craftsquare/i.test(a.name || '') || /craftsquare/i.test(a.business_name || ''))
    || adAccounts.find((a) => a.account_status === 1)
    || adAccounts[0];

  report.adAccountId = craftAccount.account_id;
  report.checks.push(`Ad account: ${craftAccount.name} (act_${craftAccount.account_id}, ${craftAccount.currency})`);
  if (!/craftsquare/i.test(`${craftAccount.name} ${craftAccount.business_name}`)) {
    report.warnings.push('Ad account name may not be CraftSquare — verify manually');
  }

  // Pixels on account
  try {
    const pixels = await graph(`/${craftAccount.id}/adspixels?fields=id,name&limit=50`);
    const list = pixels.data || [];
    const hasCorrect = list.some((p) => p.id === PIXEL_ID);
    if (hasCorrect) report.checks.push(`Pixel ${PIXEL_ID} linked to ad account`);
    else report.warnings.push(`Pixel ${PIXEL_ID} not in account pixel list — may still work via promoted_object`);
  } catch (e) {
    report.warnings.push(`Account pixels: ${e.message}`);
  }

  // Audiences
  let audienceId = null;
  try {
    const aud = await graph(
      `/${craftAccount.id}/customaudiences?fields=id,name,approximate_count_lower_bound,approximate_count_upper_bound&limit=100`,
    );
    const hit = (aud.data || []).find(
      (a) => (a.name || '').includes('Mumbai Home owners') || (a.name || '').includes('meta_audience'),
    );
    if (hit) {
      audienceId = hit.id;
      report.checks.push(`Audience: ${hit.name} (${hit.id}) size ~${hit.approximate_count_lower_bound}-${hit.approximate_count_upper_bound}`);
    } else {
      report.warnings.push(`Audience "${AUDIENCE_SEARCH}" not found — ad set may need manual audience`);
      report.audienceNames = (aud.data || []).slice(0, 10).map((a) => a.name);
    }
  } catch (e) {
    report.warnings.push(`Audiences: ${e.message}`);
  }

  // Step 2 — search existing campaign
  const camps = await graph(
    `/${craftAccount.id}/campaigns?fields=id,name,status,effective_status,objective,daily_budget&limit=200`,
  );
  let campaign = (camps.data || []).find((c) => matchesCampaign(c.name));

  const actId = craftAccount.id; // act_xxx format
  const budgetMinor = String(DAILY_BUDGET_INR * 100);

  if (campaign) {
    report.checks.push(`Recovered campaign: ${campaign.name} (${campaign.id}) status=${campaign.effective_status}`);
    report.campaignId = campaign.id;
    if (campaign.effective_status !== 'ACTIVE') {
      await graph(`/${campaign.id}`, {
        method: 'POST',
        body: { status: 'ACTIVE', daily_budget: budgetMinor },
      });
      report.checks.push('Campaign set ACTIVE with ₹700/day budget');
    }
  } else {
    report.checks.push('No existing campaign — creating');
    const created = await graph(`/${actId}/campaigns`, {
      method: 'POST',
      body: {
        name: CAMPAIGN_NAMES[0],
        objective: 'OUTCOME_LEADS',
        status: 'ACTIVE',
        special_ad_categories: [],
        daily_budget: budgetMinor,
        bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
      },
    });
    campaign = { id: created.id, name: CAMPAIGN_NAMES[0] };
    report.campaignId = created.id;
    report.checks.push(`Created campaign ${created.id}`);
  }

  // Ad sets for campaign
  const adsetsRes = await graph(
    `/${campaign.id}/adsets?fields=id,name,status,effective_status,promoted_object,destination_type,daily_budget&limit=20`,
  );
  let adset = adsetsRes.data?.[0];

  const targeting = {
    age_min: 18,
    geo_locations: {
      cities: [
        { key: '1035921' }, // Mumbai - may need search API; fallback custom_locations
      ],
      regions: [{ key: '1738' }], // Maharashtra
      country_groups: [],
      countries: ['IN'],
    },
  };

  // Resolve Mumbai area targeting via targeting search
  const locationNames = ['Mumbai', 'Borivali', 'Kandivali', 'Malad', 'Goregaon', 'Mira Road'];
  try {
    const cities = [];
    for (const loc of locationNames) {
      const search = await graph(
        `/search?type=adgeolocation&location_types=["city"]&q=${encodeURIComponent(loc + ', Maharashtra, India')}&limit=5`,
      );
      const match = (search.data || []).find((x) => x.country_code === 'IN' && /mumbai|borivali|kandivali|malad|goregaon|mira/i.test(x.name));
      if (match) cities.push({ key: match.key });
    }
    if (cities.length) targeting.ge_locations = { cities, countries: ['IN'] };
  } catch (e) {
    report.warnings.push(`Geo targeting search: ${e.message} — using Maharashtra region`);
    targeting.ge_locations = { regions: [{ key: '1738' }], countries: ['IN'] };
  }

  if (audienceId) {
    targeting.custom_audiences = [{ id: audienceId }];
  }

  const adsetBody = {
    name: `${CAMPAIGN_NAMES[0]} — Ad Set`,
    campaign_id: campaign.id,
    status: 'ACTIVE',
    daily_budget: budgetMinor,
    billing_event: 'IMPRESSIONS',
    optimization_goal: 'OFFSITE_CONVERSIONS',
    destination_type: 'WEBSITE',
    promoted_object: {
      pixel_id: PIXEL_ID,
      custom_event_type: 'LEAD',
    },
    targeting,
    advantage_autoplacement: true,
  };

  if (adset) {
    report.adSetId = adset.id;
    const po = adset.promoted_object || {};
    if (String(po.pixel_id) && String(po.pixel_id) !== PIXEL_ID) {
      report.warnings.push(`Ad set pixel ${po.pixel_id} — updating to ${PIXEL_ID}`);
      await graph(`/${adset.id}`, {
        method: 'POST',
        body: {
          promoted_object: { pixel_id: PIXEL_ID, custom_event_type: 'LEAD' },
          status: 'ACTIVE',
        },
      });
    } else {
      await graph(`/${adset.id}`, { method: 'POST', body: { status: 'ACTIVE' } });
    }
    report.checks.push(`Recovered ad set ${adset.id}`);
  } else {
    const created = await graph(`/${actId}/adsets`, { method: 'POST', body: adsetBody });
    adset = { id: created.id };
    report.adSetId = created.id;
    report.checks.push(`Created ad set ${created.id}`);
  }

  // Ads
  const adsRes = await graph(
    `/${adset.id}/ads?fields=id,name,status,effective_status,creative{object_story_spec}&limit=20`,
  );
  let ad = adsRes.data?.[0];

  // Need page ID for link ad - fetch pages
  let pageId = null;
  try {
    const pages = await graph(`/${actId}/promote_pages?fields=id,name&limit=20`);
    const page = (pages.data || []).find((p) => /craftsquare/i.test(p.name || '')) || pages.data?.[0];
    pageId = page?.id;
    if (pageId) report.checks.push(`Page: ${page.name} (${pageId})`);
  } catch (e) {
    report.warnings.push(`Pages: ${e.message}`);
  }

  if (!pageId) {
    try {
      const mePages = await graph('/me/accounts?fields=id,name&limit=20');
      const page = (mePages.data || []).find((p) => /craftsquare/i.test(p.name || '')) || mePages.data?.[0];
      pageId = page?.id;
    } catch (e) {
      report.warnings.push(`Me pages: ${e.message}`);
    }
  }

  if (!pageId) {
    report.errors.push('No Facebook Page ID found — cannot create link ad');
    printReport();
    process.exit(1);
  }

  const creativeSpec = {
    object_story_spec: {
      page_id: pageId,
      link_data: {
        link: LANDING_URL,
        message: 'Get your free interior consultation and budget estimate for your Mumbai home.',
        call_to_action: { type: 'LEARN_MORE', value: { link: LANDING_URL } },
      },
    },
  };

  if (ad) {
    report.adId = ad.id;
    const link = ad.creative?.object_story_spec?.link_data?.link;
    if (link && !link.includes('free-interior-consultation')) {
      report.warnings.push(`Ad URL was ${link} — may need creative update`);
    }
    await graph(`/${ad.id}`, { method: 'POST', body: { status: 'ACTIVE' } });
    report.checks.push(`Recovered ad ${ad.id}`);
  } else {
    const creative = await graph(`/${actId}/adcreatives`, {
      method: 'POST',
      body: { name: `${CAMPAIGN_NAMES[0]} — Creative`, ...creativeSpec },
    });
    const createdAd = await graph(`/${actId}/ads`, {
      method: 'POST',
      body: {
        name: `${CAMPAIGN_NAMES[0]} — Ad`,
        adset_id: adset.id,
        creative: { creative_id: creative.id },
        status: 'ACTIVE',
      },
    });
    report.adId = createdAd.id;
    report.checks.push(`Created ad ${createdAd.id}`);
  }

  // Landing page check
  const landing = await fetch(LANDING_URL, { method: 'GET' });
  report.checks.push(`Landing HTTP ${landing.status}`);
  const html = await landing.text();
  if (!html.includes(PIXEL_ID)) report.warnings.push('Pixel not found in landing HTML');

  // Final publish confirmation
  const finalCamp = await graph(
    `/${campaign.id}?fields=id,name,status,effective_status,daily_budget`,
  );
  const finalAdset = await graph(`/${adset.id}?fields=id,status,effective_status,promoted_object`);
  const finalAd = await graph(`/${report.adId}?fields=id,status,effective_status`);

  if (finalCamp.effective_status === 'ACTIVE' || finalCamp.status === 'ACTIVE') {
    report.status = 'PUBLISHED';
  } else if (finalCamp.effective_status === 'IN_PROCESS') {
    report.status = 'PUBLISHED';
    report.warnings.push('Campaign IN_PROCESS — Meta review may delay delivery');
  } else {
    report.status = finalCamp.effective_status || finalCamp.status;
    report.warnings.push(`Campaign effective_status=${finalCamp.effective_status}`);
  }

  if (String(finalAdset.promoted_object?.pixel_id) !== PIXEL_ID) {
    report.errors.push(`Final ad set pixel mismatch: ${finalAdset.promoted_object?.pixel_id}`);
  }

  report.checks.push(`Final: campaign=${finalCamp.effective_status} adset=${finalAdset.effective_status} ad=${finalAd.status}`);
  printReport();
  process.exit(report.errors.length ? 1 : 0);
}

function printReport() {
  console.log(JSON.stringify(report, null, 2));
}

main().catch((e) => {
  report.errors.push(`${e.message}${e.code ? ` (#${e.code})` : ''}`);
  if (e.raw) report.errors.push(JSON.stringify(e.raw));
  printReport();
  process.exit(1);
});
