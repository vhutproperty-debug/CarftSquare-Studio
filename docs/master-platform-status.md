# CraftSquare Master Platform — Continuity Report

**Status: NOT COMPLETE.** WhatsApp Cloud API, ops inbox, follow-ups, and Meta lead foundations are in progress. Do not treat this as master-platform done.

## A. Already existing (pre-continue)

- WhatsApp webhook ingest, signature verify, idempotent events, conversations/messages
- Non-destructive identity matching
- Ops WhatsApp Inbox UI + reply/link/read APIs
- Meta Pixel + CAPI infrastructure (`lib/meta-capi`)
- CRM demand/supply/deals/calls/matching workspaces
- WhatsApp phone number id `1307101749164145`

## B. Newly built (this continue pass)

- Scheduled follow-up engine (`ops_follow_up_jobs`, worker, cron tick GET+POST)
- Template catalog + integration status API
- Rules-based AI insights with provenance (`wa_ai_insights`)
- WhatsApp campaigns (create/start/batch, throttling, recipient claim)
- Meta Lead Ads webhook + `meta_ads` lead adapter + optional CAPI Lead
- Ops pages: `/ops/automation`, `/ops/campaigns`
- Estimate quote → welcome follow-up hook
- Demand `nextFollowUpAt` → WhatsApp follow-up enqueue
- Opt-out cancels pending follow-ups

## C. Modified

- `lib/ops/business.ts` nav, `ops-nav-icons`, dashboard WhatsApp strip
- WhatsApp inbox template picker + schedule follow-up
- Cloud API client retries
- Demand patch schema (`scheduleWhatsApp`)
- `vercel.json` cron
- `.env.example` / docs

## D. Fully tested

- Run `npm run test:wa-cloud`, `npm run test:meta-leads`, and `npm run test:lead-pipeline` after changes.
- Live WhatsApp E2E is not claimed without approved templates and a system user token.

## E. Production configuration still requiring manual credentials

| Item | Where |
|---|---|
| WhatsApp webhook URL + verify token + `META_APP_SECRET` | Meta App + Vercel |
| `WHATSAPP_ACCESS_TOKEN` or `META_SYSTEM_USER_TOKEN` | Vercel Production |
| Approved template names (`lead_welcome` and follow-ups) | WhatsApp Manager |
| `CRON_SECRET` / `OPS_FOLLOWUPS_CRON_SECRET` | Vercel |
| Meta Lead Ads page subscription + `META_LEAD_ADS_VERIFY_TOKEN` | Meta App |
| `META_PAGE_ACCESS_TOKEN` for lead enrich | Meta / Vercel |

## F. Remaining technical debt

- Session text is sent only inside the 24-hour customer-care window
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
