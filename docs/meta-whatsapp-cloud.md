# CraftSquare Meta Lead Ads + WhatsApp Cloud API

WhatsApp sends go through Meta's Cloud API on the Craftsquare Ops app. Marketing API writes stay off until `META_ADS_ENABLED=true`.

## Assets

| Asset | ID |
|---|---|
| App | 1763222411450184 |
| Business | 1420297320045438 |
| WABA | 4424945177816319 |
| Phone number | 1307101749164145 |
| Page | 1351127224742253 |
| Ad account | act_1947289589273795 |
| Pixel | 1391594993119180 |

## Webhooks

| Product | Callback | Verify token env |
|---|---|---|
| WhatsApp | `https://craftsquare.co.in/api/webhooks/whatsapp` | `WHATSAPP_VERIFY_TOKEN` |
| Page leadgen | `https://craftsquare.co.in/api/webhooks/meta-leads` | `META_LEAD_ADS_VERIFY_TOKEN` |

Both POST handlers require `X-Hub-Signature-256` signed with `META_APP_SECRET`. A missing secret is rejected.

Subscribe the Page and the WABA with a system user token:

```bash
curl -X POST "https://graph.facebook.com/v22.0/1351127224742253/subscribed_apps" \
  -d "subscribed_fields=leadgen" \
  -d "access_token=$META_SYSTEM_USER_TOKEN"

curl -X POST "https://graph.facebook.com/v22.0/4424945177816319/subscribed_apps" \
  -d "access_token=$META_SYSTEM_USER_TOKEN"
```

WhatsApp fields: `messages`, `message_template_status_update`, `message_template_quality_update`, `phone_number_quality_update`, `account_update`.

## Templates to submit in WhatsApp Manager

| Name | Category | Body variables |
|---|---|---|
| `lead_welcome` | Utility | name, project |
| `lead_followup_day1` | Utility | name |
| `lead_followup_day3` | Utility | name |
| `site_visit_reminder` | Utility | name, when |
| `owner_new_lead_alert` | Utility | name, phone, source, campaign |
| `callback_missed` | Utility | name |

Suggested `lead_welcome` body: `Hi {{1}}, thanks for your enquiry about {{2}} with CraftSquare. Our advisor will call you shortly. Reply here for brochure/site visit.`

## Lead flow

1. Leadgen webhook stores `meta_ads_leads` with campaign and ad names.
2. Failed Graph enrichment is queued in `meta_lead_enrich_jobs` and retried by `/api/ops/followups/tick`.
3. `onNewLead` assigns a round-robin owner from `LEAD_ASSIGNEES`, sends `lead_welcome`, emails and WhatsApps `OWNER_ALERT_*`, and schedules day-1 and day-3 follow-ups.
4. An inbound reply or a demand status of Contacted or Lost cancels queued follow-ups.
5. `STOP` or `UNSUBSCRIBE` opts the contact out.

## Collections

New writes use `wa_conversations`, `wa_messages`, `wa_webhook_events`, `wa_templates`, `wa_contacts`, `wa_message_attempts`, `wa_delivery_retries`, `wa_delivery_transitions`, `wa_ai_insights`.

Copy historical rows with:

```bash
npm run migrate:wa-cloud -- --dry-run
npm run migrate:wa-cloud
```

## Crons

| Path | Schedule |
|---|---|
| `/api/ops/followups/tick` | every 10 minutes |
| `/api/ops/whatsapp/templates/sync` | hourly |
| `/api/ops/ads/insights/sync` | every 6 hours (no-op unless `META_ADS_ENABLED=true`) |

Send `Authorization: Bearer $CRON_SECRET`.

## Env vars

See `.env.example`. Required on Vercel before the live flow works:

`META_APP_SECRET`, `META_LEAD_ADS_VERIFY_TOKEN`, `META_PAGE_ACCESS_TOKEN` or `META_SYSTEM_USER_TOKEN`, `META_BUSINESS_ID`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_WABA_ID`, `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_ACCESS_TOKEN` (or the system user token), `OWNER_ALERT_WHATSAPP`, `OWNER_ALERT_EMAIL`, `LEAD_ASSIGNEES`, `RESEND_API_KEY`, `EMAIL_FROM`, `CRON_SECRET`, `NEXT_PUBLIC_SITE_URL`.

Keep `META_ADS_ENABLED` unset or `false` until ads permissions are approved. `META_ADS_ALLOW_ACTIVE` stays `false`. Published ads are PAUSED.
