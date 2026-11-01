import assert from 'node:assert/strict';
import { MetaAdsApiError } from '../lib/meta-ads/client';
import { listAdAccountCampaigns } from '../lib/meta-ads/account-campaigns';
import { readBusinessAssets } from '../lib/meta-ads/business-assets';
import { publishPausedLeadCampaign } from '../lib/meta-ads/publish-paused';
import { dedupeDryRunCampaigns, listCampaignRecords } from '../lib/meta-ads/store';
import { createMemoryDb } from './lib/memory-db';
import { updateMetaObjectStatus } from '../lib/meta-ads/controls';
import { normalizeCampaignInsight, readCampaignInsights } from '../lib/meta-ads/insights';
import {
  RESUME_BLOCKED_ACTIVE_LOCKED,
  RESUME_BLOCKED_ADS_DISABLED,
  META_PERMISSION_PENDING_MESSAGE,
} from '../lib/meta-ads/messages';
import { listAccessiblePages } from '../lib/meta-ads/pages';
import {
  getPageLeadSubscription,
  subscribePageToLeadgen,
  unsubscribePageFromLeadgen,
} from '../lib/meta-ads/page-subscription';
import { buildLeadDetailsUrl, fetchLeadDetails } from '../lib/meta-leads/ingest';

type Call = { url: string; method: string; body: string };

const originalFetch = global.fetch;

function callsOf(impl: (call: Call) => Response | Promise<Response>) {
  const calls: Call[] = [];
  global.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const call = {
      url: String(input),
      method: init?.method || 'GET',
      body: typeof init?.body === 'string' ? init.body : '',
    };
    calls.push(call);
    return impl(call);
  }) as typeof fetch;
  return calls;
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function permissionDenied() {
  return jsonResponse({
    error: {
      message: '(#200) Requires ads_management permission to manage the object',
      type: 'OAuthException',
      code: 200,
    },
  }, 400);
}

async function withEnv(patch: Record<string, string | undefined>, fn: () => Promise<void>) {
  const saved: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(patch)) {
    saved[key] = process.env[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    await fn();
  } finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    global.fetch = originalFetch;
  }
}

async function main() {
  await withEnv({
    META_SYSTEM_USER_TOKEN: 'system-user',
    META_ADS_ENABLED: undefined,
    META_ADS_ALLOW_ACTIVE: undefined,
    META_GRAPH_API_VERSION: 'v23.0',
    META_AD_ACCOUNT_ID: 'act_1947289589273795',
  }, async () => {
    const calls = callsOf(() => jsonResponse({ success: true }));
    await updateMetaObjectStatus({ objectId: '111', status: 'PAUSED', allowActive: false });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].method, 'POST');
    assert.match(calls[0].url, /graph\.facebook\.com\/v23\.0\/111\?/);
    assert.equal(calls[0].url.includes('v19.0'), false);
    assert.match(calls[0].url, /access_token=system-user/);
    assert.match(calls[0].body, /"status":"PAUSED"/);

    calls.length = 0;
    await assert.rejects(
      () => updateMetaObjectStatus({ objectId: '111', status: 'ACTIVE', allowActive: true }),
      (error: unknown) => {
        assert.equal((error as Error).message, RESUME_BLOCKED_ADS_DISABLED);
        return true;
      },
    );
    assert.equal(calls.length, 0);
  });

  await withEnv({
    META_SYSTEM_USER_TOKEN: 'system-user',
    META_ADS_ENABLED: 'true',
    META_ADS_ALLOW_ACTIVE: undefined,
    META_GRAPH_API_VERSION: 'v22.0',
  }, async () => {
    const calls = callsOf(() => jsonResponse({ success: true }));
    await assert.rejects(
      () => updateMetaObjectStatus({ objectId: '222', status: 'ACTIVE', allowActive: true }),
      (error: unknown) => {
        assert.equal((error as Error).message, RESUME_BLOCKED_ACTIVE_LOCKED);
        return true;
      },
    );
    assert.equal(calls.length, 0);
  });

  await withEnv({
    META_SYSTEM_USER_TOKEN: 'system-user',
    META_ADS_ENABLED: 'true',
    META_ADS_ALLOW_ACTIVE: 'true',
    META_GRAPH_API_VERSION: 'v22.0',
  }, async () => {
    const calls = callsOf(() => jsonResponse({ success: true }));
    await updateMetaObjectStatus({ objectId: '333', status: 'ACTIVE', allowActive: true });
    assert.equal(calls.length, 1);
    assert.match(calls[0].body, /"status":"ACTIVE"/);
    await assert.rejects(
      () => updateMetaObjectStatus({ objectId: '333', status: 'ACTIVE', allowActive: false }),
      /admin role/i,
    );
  });

  await withEnv({
    META_SYSTEM_USER_TOKEN: 'system-user',
    META_GRAPH_API_VERSION: 'v22.0',
    META_AD_ACCOUNT_ID: '1947289589273795',
  }, async () => {
    const calls = callsOf((call) => {
      if (call.url.includes('/campaigns')) {
        return jsonResponse({
          data: [{
            id: '555',
            name: 'Goregaon owners',
            status: 'PAUSED',
            effective_status: 'PAUSED',
            objective: 'OUTCOME_LEADS',
          }],
        });
      }
      return permissionDenied();
    });
    const campaigns = await listAdAccountCampaigns();
    assert.equal(campaigns[0].name, 'Goregaon owners');
    assert.match(calls[0].url, /\/act_1947289589273795\/campaigns/);
    assert.match(calls[0].url, /\/v22\.0\//);
    await assert.rejects(
      () => readCampaignInsights({ preset: 'last_7d' }),
      (error: unknown) => {
        assert.ok(error instanceof MetaAdsApiError);
        assert.equal(error.permissionPending, true);
        assert.equal(error.message, META_PERMISSION_PENDING_MESSAGE);
        return true;
      },
    );
  });

  const row = normalizeCampaignInsight({
    campaign_id: '555',
    campaign_name: 'Goregaon owners',
    spend: '100.50',
    impressions: '1000',
    clicks: '40',
    actions: [
      { action_type: 'link_click', value: '40' },
      { action_type: 'lead', value: '4' },
      { action_type: 'onsite_conversion.lead_grouped', value: '5' },
    ],
    cost_per_action_type: [
      { action_type: 'onsite_conversion.lead_grouped', value: '20.10' },
    ],
  });
  assert.equal(row?.leads, 5);
  assert.equal(row?.cpl, 20.1);
  assert.equal(row?.spend, 100.5);
  assert.equal(row?.impressions, 1000);
  assert.equal(row?.clicks, 40);

  await withEnv({
    META_SYSTEM_USER_TOKEN: 'system-user',
    META_GRAPH_API_VERSION: 'v22.0',
    META_AD_ACCOUNT_ID: 'act_1947289589273795',
  }, async () => {
    const calls = callsOf(() => jsonResponse({
      data: [{
        campaign_id: '555',
        campaign_name: 'Goregaon owners',
        spend: '10',
        impressions: '100',
        clicks: '2',
        actions: [{ action_type: 'lead', value: '2' }],
      }],
    }));
    const presetRows = await readCampaignInsights({ preset: 'last_30d' });
    assert.equal(presetRows[0].leads, 2);
    assert.equal(presetRows[0].cpl, 5);
    assert.match(calls[0].url, /\/act_1947289589273795\/insights/);
    assert.match(calls[0].url, /date_preset=last_30d/);
    assert.equal(calls[0].url.includes('v19.0'), false);

    calls.length = 0;
    await readCampaignInsights({ since: '2026-10-01', until: '2026-10-31' });
    assert.match(decodeURIComponent(calls[0].url), /"since":"2026-10-01"/);
    assert.match(decodeURIComponent(calls[0].url), /"until":"2026-10-31"/);
    assert.equal(calls[0].url.includes('date_preset'), false);

    calls.length = 0;
    await assert.rejects(() => readCampaignInsights({ since: '2026-11-02', until: '2026-10-01' }), /start date/i);
    assert.equal(calls.length, 0);
  });

  await withEnv({
    META_SYSTEM_USER_TOKEN: 'system-user',
    META_GRAPH_API_VERSION: 'v22.0',
    META_BUSINESS_ID: '1420297320045438',
    META_AD_ACCOUNT_ID: 'act_1947289589273795',
    META_PAGE_ID: '1351127224742253',
  }, async () => {
    const calls = callsOf((call) => {
      if (call.url.includes('/owned_ad_accounts')) return permissionDenied();
      if (call.url.includes('/owned_pages')) {
        return jsonResponse({
          data: [{ id: '1351127224742253', name: 'CraftSquare', fan_count: 1280 }],
        });
      }
      return jsonResponse({});
    });
    const assets = await readBusinessAssets();
    const accountCall = calls.find((call) => call.url.includes('/owned_ad_accounts'));
    const pageCall = calls.find((call) => call.url.includes('/owned_pages'));
    assert.ok(accountCall);
    assert.ok(pageCall);
    assert.match(accountCall.url, /\/1420297320045438\/owned_ad_accounts\?/);
    assert.match(decodeURIComponent(accountCall.url), /fields=id,name,account_status,currency/);
    assert.equal(accountCall.url.includes('fields=owned_ad_accounts'), false);
    assert.match(decodeURIComponent(pageCall.url), /fields=id,name,fan_count/);
    assert.equal(pageCall.url.includes('fields=owned_pages'), false);
    assert.ok(calls.some((call) => call.url.includes('/1420297320045438/client_ad_accounts?')));
    assert.equal(assets.businessId, '1420297320045438');
    assert.equal(assets.adAccounts.ok, false);
    if (!assets.adAccounts.ok) {
      assert.equal(assets.adAccounts.permissionPending, true);
      assert.equal(assets.adAccounts.error, META_PERMISSION_PENDING_MESSAGE);
    }
    assert.equal(assets.pages.ok, true);
    if (assets.pages.ok) {
      assert.equal(assets.pages.data[0].configured, true);
      assert.equal(assets.pages.data[0].name, 'CraftSquare');
      assert.equal(assets.pages.data[0].fanCount, 1280);
      assert.equal(assets.pages.data[0].source, 'owned');
    }
  });

  await withEnv({
    META_SYSTEM_USER_TOKEN: 'system-user',
    META_GRAPH_API_VERSION: 'v22.0',
    META_BUSINESS_ID: '14202973',
    META_AD_ACCOUNT_ID: 'act_1947289589273795',
    META_PAGE_ID: '1351127224742253',
  }, async () => {
    const calls = callsOf((call) => {
      if (call.url.includes('/owned_ad_accounts') || call.url.includes('/owned_pages')) {
        return jsonResponse({
          error: {
            message: '(#100) Tried accessing nonexisting field (owned_ad_accounts)',
            code: 100,
            type: 'OAuthException',
          },
        }, 400);
      }
      if (call.url.includes('/client_ad_accounts')) {
        return jsonResponse({
          data: [{ id: 'act_1947289589273795', name: 'CraftSquare Ads', account_status: 1, currency: 'INR' }],
        });
      }
      if (call.url.includes('/client_pages')) {
        return jsonResponse({
          data: [{ id: '1351127224742253', name: 'CraftSquare', fan_count: 90 }],
        });
      }
      return jsonResponse({ data: [] });
    });
    const assets = await readBusinessAssets();
    assert.equal(assets.businessId, '1420297320045438');
    assert.equal(assets.businessId.length, 16);
    assert.ok(calls.some((call) => call.url.includes('/1420297320045438/client_ad_accounts?')));
    assert.ok(calls.some((call) => call.url.includes('/1420297320045438/client_pages?')));
    assert.equal(assets.adAccounts.ok, true);
    if (assets.adAccounts.ok) {
      assert.equal(assets.adAccounts.data[0].source, 'client');
      assert.equal(assets.adAccounts.data[0].configured, true);
    }
    assert.equal(assets.pages.ok, true);
    if (assets.pages.ok) assert.equal(assets.pages.data[0].fanCount, 90);
  });

  await withEnv({
    META_SYSTEM_USER_TOKEN: 'system-user',
    META_GRAPH_API_VERSION: 'v22.0',
    META_PAGE_ID: '1351127224742253',
    META_PAGE_ACCESS_TOKEN: undefined,
    META_LEAD_ADS_PAGE_TOKEN: undefined,
  }, async () => {
    const calls = callsOf((call) => {
      if (call.url.includes('/me/accounts')) {
        return jsonResponse({
          data: [{
            id: '1351127224742253',
            name: 'CraftSquare',
            category: 'Real estate',
            access_token: 'page-token',
          }],
        });
      }
      if (call.url.includes('leadgen_forms')) {
        return jsonResponse({
          data: [{ id: 'form-1', name: 'Rent enquiry', status: 'ACTIVE' }],
        });
      }
      if (call.url.includes('fields=name%2Cfan_count') || call.url.includes('fields=name,fan_count')) {
        return jsonResponse({ name: 'CraftSquare', fan_count: 1280 });
      }
      if (call.method === 'POST' && call.url.includes('/subscribed_apps')) {
        return jsonResponse({ success: true });
      }
      if (call.method === 'DELETE' && call.url.includes('/subscribed_apps')) {
        return jsonResponse({ success: true });
      }
      if (call.method === 'GET' && call.url.includes('/subscribed_apps')) {
        return jsonResponse({
          data: [{ id: '1763222411450184', name: 'Craftsquare Ops', subscribed_fields: ['leadgen'] }],
        });
      }
      return jsonResponse({});
    });

    const pages = await listAccessiblePages();
    assert.equal(JSON.stringify(pages).includes('page-token'), false);
    assert.equal(JSON.stringify(pages).includes('access_token'), false);
    assert.equal(pages[0].name, 'CraftSquare');
    assert.equal(pages[0].fanCount, 1280);
    assert.equal(pages[0].leadForms[0].name, 'Rent enquiry');
    assert.equal(pages[0].configured, true);
    const pageReads = calls.filter((call) => call.url.includes('page-token'));
    assert.ok(pageReads.length >= 2);
    assert.ok(pageReads.every((call) => !call.url.includes('system-user')));

    calls.length = 0;
    await subscribePageToLeadgen();
    const post = calls.find((call) => call.method === 'POST');
    assert.ok(post);
    assert.match(post.url, /\/v22\.0\/1351127224742253\/subscribed_apps\?subscribed_fields=leadgen/);
    assert.match(post.url, /access_token=page-token/);
    assert.equal(post.url.includes('system-user'), false);
    assert.equal(post.url.includes('v19.0'), false);

    calls.length = 0;
    const status = await getPageLeadSubscription();
    assert.equal(status.leadgenSubscribed, true);
    assert.deepEqual(status.apps[0].subscribedFields, ['leadgen']);
    const statusCall = calls.find((call) => call.url.includes('/subscribed_apps') && call.method === 'GET');
    assert.ok(statusCall);
    assert.match(statusCall.url, /access_token=page-token/);

    calls.length = 0;
    await unsubscribePageFromLeadgen();
    const deleted = calls.find((call) => call.method === 'DELETE');
    assert.ok(deleted);
    assert.match(deleted.url, /\/1351127224742253\/subscribed_apps\?/);
    assert.match(deleted.url, /access_token=page-token/);
    assert.equal(deleted.url.includes('system-user'), false);
  });

  await withEnv({
    META_GRAPH_API_VERSION: 'v23.0',
    META_PAGE_ACCESS_TOKEN: 'page-token',
    META_SYSTEM_USER_TOKEN: 'system-user',
  }, async () => {
    const url = buildLeadDetailsUrl('lead-100', 'page-token');
    assert.match(url, /^https:\/\/graph\.facebook\.com\/v23\.0\/lead-100\?/);
    assert.equal(url.includes('v19.0'), false);
    assert.match(url, /access_token=page-token/);
    const calls = callsOf((call) => {
      assert.match(call.url, /\/v23\.0\/lead-100/);
      assert.equal(call.url.includes('v19.0'), false);
      assert.match(call.url, /access_token=page-token/);
      assert.equal(call.url.includes('system-user'), false);
      return jsonResponse({
        field_data: [{ name: 'full_name', values: ['Asha Patel'] }],
      });
    });
    const lead = await fetchLeadDetails('lead-100');
    assert.equal(lead.ok, true);
    assert.equal(lead.name, 'Asha Patel');
    assert.equal(calls.length, 1);
  });

  await withEnv({
    META_GRAPH_API_VERSION: 'not-a-version',
    META_PAGE_ACCESS_TOKEN: 'page-token',
  }, async () => {
    const url = buildLeadDetailsUrl('lead-100', 'page-token');
    assert.match(url, /\/v22\.0\/lead-100/);
    assert.equal(url.includes('v19.0'), false);
  });

  await withEnv({
    META_SYSTEM_USER_TOKEN: 'system-user',
    META_ADS_ENABLED: 'true',
    META_ADS_ALLOW_ACTIVE: undefined,
    META_GRAPH_API_VERSION: 'v22.0',
    META_AD_ACCOUNT_ID: 'act_1947289589273795',
    META_PAGE_ID: '1351127224742253',
  }, async () => {
    const calls = callsOf((call) => {
      if (call.url.includes('/me/permissions')) {
        return jsonResponse({ data: [{ permission: 'ads_management', status: 'granted' }] });
      }
      if (call.method === 'POST' && /\/campaigns\?/.test(call.url)) return jsonResponse({ id: 'cmp-housing' });
      if (call.method === 'POST') return jsonResponse({ id: 'obj-1' });
      return jsonResponse({ id: 'node-1', name: 'CraftSquare', data: [] });
    });
    const result = await publishPausedLeadCampaign({
      campaign: {
        id: 'local-1',
        name: 'Goregaon owners',
        creativeId: 'creative-1',
        objective: 'OUTCOME_LEADS',
        destination: 'instant_form',
        dailyBudgetInr: 500,
        status: 'ready',
        metaStatus: 'NONE',
        dryRun: true,
        areas: ['Mumbai'],
        createdBy: 'admin',
        createdAt: '2026-11-01T00:00:00.000Z',
        updatedAt: '2026-11-01T00:00:00.000Z',
      },
      creative: {
        id: 'creative-1',
        offer: 'Rent',
        audienceHint: 'Owners',
        areas: ['Mumbai'],
        primaryText: 'Is your flat available?',
        headline: 'Goregaon',
        description: 'Rental enquiry',
        cta: 'SIGN_UP',
        angle: 'availability',
        status: 'approved',
        createdBy: 'admin',
        createdAt: '2026-11-01T00:00:00.000Z',
        updatedAt: '2026-11-01T00:00:00.000Z',
      },
    });
    assert.equal(result.ok, true, result.error);
    const campaignPost = calls.find((call) => call.method === 'POST' && /\/campaigns\?/.test(call.url));
    assert.ok(campaignPost);
    const body = JSON.parse(campaignPost.body) as { special_ad_categories?: string[]; status?: string };
    assert.deepEqual(body.special_ad_categories, ['HOUSING']);
    assert.equal(body.status, 'PAUSED');
    const adSetPost = calls.find((call) => call.method === 'POST' && call.url.includes('/adsets'));
    assert.ok(adSetPost);
    assert.equal(adSetPost.body.includes('age_min'), false);
  });

  const db = createMemoryDb();
  const campaigns = db.collection('ops_meta_ad_campaigns');
  await campaigns.insertOne({
    id: 'dry-1',
    name: 'CraftSquare Leads — Dry Run',
    objective: 'OUTCOME_LEADS',
    updatedAt: '2026-02-01T00:00:00.000Z',
  });
  await campaigns.insertOne({
    id: 'dry-2',
    name: 'CraftSquare Leads — Dry Run',
    objective: 'OUTCOME_LEADS',
    updatedAt: '2026-01-01T00:00:00.000Z',
  });
  const removed = await dedupeDryRunCampaigns(db as never);
  assert.equal(removed, 0);
  assert.equal(await campaigns.countDocuments(), 2);
  const listed = await listCampaignRecords(db as never);
  assert.equal(listed.length, 2);
  assert.equal(await campaigns.countDocuments(), 2);

  console.log('test:meta-review ok');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
