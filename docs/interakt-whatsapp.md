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
```

The runtime rejects `INTERAKT_BUSINESS_WA_NUMBER=917304242604`.

## Architecture

```
Interakt WhatsApp (919867525258)
  → POST /api/webhooks/interakt  (HMAC Interakt-Signature)
  → interakt_webhook_events (idempotent)
  → async process (waitUntil)
  → interakt_conversations + interakt_messages
  → non-destructive phone match → ops_prospects / supply / leads
  → optional demand/supply activity note when already linked
```

Meta Cloud WhatsApp (`WHATSAPP_*`, quote send, marketing `wa.me`) is a **separate** stack. Do not merge.

## Ops Admin Inbox

- UI: `/ops/whatsapp`
- List / thread / mark read / manual CRM link / send **approved templates**
- Free-form session text is **not** on Interakt public API (Template-only). Agents can continue session chat in Interakt until Interakt documents a session endpoint.

## Webhook

- URL: `https://craftsquare.co.in/api/webhooks/interakt`
- Method: POST
- Auth: `Interakt-Signature: sha256=` + HMAC-SHA256(secret, raw body)

## Collections

- `interakt_webhook_events`
- `interakt_conversations`
- `interakt_messages`

## Deploy notes

After changing Interakt env vars on Vercel, redeploy Production so serverless functions pick up values.
