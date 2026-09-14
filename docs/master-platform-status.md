# CraftSquare Master Platform — Continuity Report

**Status: NOT COMPLETE.** Interakt foundation + Ops inbox + follow-up/campaign/Meta foundations are in progress. Do not treat this as master-platform done.

## A. Already existing (pre-continue)

- Phase 1 Interakt webhook ingest, HMAC verify, idempotent events, conversations/messages
- Non-destructive identity matching
- Ops WhatsApp Inbox UI + reply/link/read APIs
- Meta Pixel + CAPI infrastructure (`lib/meta-capi`)
- CRM demand/supply/deals/calls/matching workspaces
- Locked production WA `919867525258`

## B. Newly built (this continue pass)

- Scheduled follow-up engine (`ops_follow_up_jobs`, worker, cron tick GET+POST)
- Template catalog + integration status API
- Rules-based AI insights with provenance (`interakt_ai_insights`)
- WhatsApp campaigns (create/start/batch, throttling, recipient claim)
- Meta Lead Ads webhook + `meta_ads` lead adapter + optional CAPI Lead
- Ops pages: `/ops/automation`, `/ops/campaigns`
- Estimate quote → welcome follow-up hook
- Demand `nextFollowUpAt` → WhatsApp follow-up enqueue
- Opt-out cancels pending follow-ups

## C. Modified

- `lib/ops/business.ts` nav, `ops-nav-icons`, dashboard Interakt strip
- WhatsApp inbox template picker + schedule follow-up
- Interakt client retries
- Demand patch schema (`scheduleWhatsApp`)
- `vercel.json` cron
- `.env.example` / docs

## D. Fully tested

- Run `npm run test:interakt-phase1` and `npm run test:interakt-platform` after changes.
- Live WhatsApp E2E and live template send are **not** claimed tested without Interakt dashboard + `INTERAKT_API_KEY` + approved template names.

## E. Production configuration still requiring manual credentials

| Item | Where |
|---|---|
| Interakt Developer webhook URL + secret + events | Interakt dashboard |
| `INTERAKT_API_KEY` | Vercel Production |
| Approved template code names matching catalog | Interakt + optional `INTERAKT_TEMPLATE_CATALOG` |
| `CRON_SECRET` / `OPS_FOLLOWUPS_CRON_SECRET` | Vercel |
| Meta Lead Ads page subscription + `META_LEAD_ADS_VERIFY_TOKEN` | Meta App |
| Optional `META_APP_SECRET`, page token enrich | Meta / Vercel |
| Interakt plan for inbound customer webhooks | Interakt billing |

## F. Remaining technical debt

- Session free-form WhatsApp API not documented by Interakt — agents use Interakt UI for session chat
- AI is rules-only (no OpenAI enrichment yet)
- Campaign audiences are manual phones only (CRM audience selectors partial)
- Meta lead dedupe vs existing CRM is adapter/list-level; no destructive merge
- Stuck `sending` campaign recipients if process crashes mid-send (needs reclaim TTL)

## G. Remaining roadmap items

- Full CRM reminder/notification fan-out beyond WhatsApp jobs
- Richer campaign analytics UI
- OpenAI orchestration behind confidence/provenance gates
- Meta Lead Ads operational status page + conversion dashboards
- Reclaim/TTL for stuck jobs
- Declaring **MASTER PLATFORM COMPLETE** only after all above are implemented and verified
