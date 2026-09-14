# CraftSquare Interakt WhatsApp Integration

## Production WhatsApp number (LOCKED)

| Field | Value |
|---|---|
| Display | +91 98675 25258 |
| E.164 digits | **919867525258** |

**Do not use** the CraftSquare marketing number `917304242604` (`+91 73042 42604`) for Interakt production traffic. That number may appear in historical marketing/brand links and old smoke data only.

Env:

```bash
INTERAKT_BUSINESS_WA_NUMBER=919867525258
INTERAKT_WEBHOOK_SECRET=<shared secret from Interakt developer settings>
INTERAKT_API_KEY=<Basic auth API key for template send>
# Optional JSON override for approved template catalog:
# INTERAKT_TEMPLATE_CATALOG=[{"name":"craftsquare_follow_up","label":"Follow-up","languageCode":"en","bodyVariableCount":1,"purpose":"follow_up"}]
OPS_FOLLOWUPS_CRON_SECRET=<optional dedicated cron header secret>
CRON_SECRET=<Vercel Cron bearer secret>
```

The runtime rejects `INTERAKT_BUSINESS_WA_NUMBER=917304242604`.

## End-to-end workflow

```
Customer WhatsApp
  → Interakt (919867525258)
  → POST /api/webhooks/interakt  (HMAC Interakt-Signature)
  → interakt_webhook_events (idempotent)
  → async process (waitUntil)
  → interakt_conversations + interakt_messages
  → non-destructive phone match → ops_prospects / supply / leads
  → Ops WhatsApp Inbox (/ops/whatsapp)
  → demand/supply activity when linked
  → AI rules insight (intent/summary; never invents CRM facts)
  → approved template reply OR scheduled follow-up job
  → Interakt public Template API
  → Customer WhatsApp
```

Meta Cloud WhatsApp (`WHATSAPP_*`, quote send, marketing `wa.me`) is a **separate** stack. Do not merge.

## Ops surfaces

| Path | Purpose |
|---|---|
| `/ops/whatsapp` | Conversation inbox, link CRM, send templates, schedule follow-ups |
| `/ops/automation` | Follow-up job queue + Interakt health |
| `/ops/campaigns` | Throttled approved-template campaigns |
| `/ops` dashboard | Interakt status strip |

## Follow-up engine

- Collection: `ops_follow_up_jobs`
- APIs: `GET/POST/PATCH /api/ops/followups`, tick `GET|POST /api/ops/followups/tick`
- Cron: `vercel.json` → `*/5 * * * *` (auth via `CRON_SECRET` Bearer or `x-ops-followups-secret`)
- Features: idempotency keys, claim/run, retries, cancel, reschedule, audit via `ops_activity_logs`
- Tick also advances **running/scheduled** WhatsApp campaigns

## Campaigns

- Collections: `ops_wa_campaigns`, `ops_wa_campaign_recipients`
- Manual phone audiences (max 500), throttle 1–60/min, recipient claim → `sending` → `sent|failed`
- Templates only; no uncontrolled free-form mass messaging

## Meta Lead Ads

- Webhook: `GET|POST /api/webhooks/meta-leads`
- Verify: `META_LEAD_ADS_VERIFY_TOKEN`
- Optional: `META_APP_SECRET` (X-Hub-Signature-256), `META_ACCESS_TOKEN` / `META_LEAD_ADS_PAGE_TOKEN` for Graph enrich
- Collection: `meta_ads_leads` (Ops source `meta_ads`)
- On accept: optional CAPI `Lead` event via existing `lib/meta-capi` (same pixel; no duplicate ad account)

## Webhook (Interakt)

- URL: `https://craftsquare.co.in/api/webhooks/interakt`
- Method: POST
- Auth: `Interakt-Signature: sha256=` + HMAC-SHA256(secret, raw body)

## Collections

- `interakt_webhook_events`, `interakt_conversations`, `interakt_messages`
- `interakt_ai_insights`
- `ops_follow_up_jobs`
- `ops_wa_campaigns`, `ops_wa_campaign_recipients`
- `meta_ads_leads`

## Identity matching (non-destructive)

Order: `ops_prospects` → `ops_supply_records` → federated leads (incl. `meta_ads`).  
Multi-match → `ambiguous`. **Never** auto-create person/lead from WhatsApp.

## Delivery / auto-recovery engine

CraftSquare owns campaign message lifecycle end-to-end:

1. Submit (attempt ledger) → Interakt template API  
2. Webhook status → match by Interakt message id / callbackData  
3. Classify failure → RETRYABLE | PERMANENT | UNKNOWN  
4. Schedule persistent retry jobs (exponential backoff)  
5. Reconcile until every recipient is terminal  

**100% reconciled** ≠ **100% delivered**. Terminal states: `DELIVERED`, `READ`, `PERMANENT_FAILURE`, `CANCELLED`.

### Collections (additive)

- `interakt_message_attempts` — never overwrite attempts  
- `interakt_delivery_transitions` — audit trail  
- `interakt_delivery_retries` — persistent retry queue  

Recipients on `ops_wa_campaign_recipients` gain `deliveryState` (legacy `status` kept in sync).

### Cron

`/api/ops/followups/tick` also runs delivery retries, stuck-SUBMITTING reclaim, and campaign reconciliation.

### Ops UI

`/ops/campaigns` — delivery stats, recipient states, manual retry/cancel/reconcile.

## Deploy notes

After changing Interakt/Meta/cron env vars on Vercel, redeploy Production so serverless functions pick up values.

Manual Interakt dashboard steps still required for live inbound: Developer Settings webhook URL + secret + `message_received` / status events + plan that supports customer message webhooks.
