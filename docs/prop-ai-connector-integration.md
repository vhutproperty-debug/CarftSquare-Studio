# Prop AI ↔ CraftSquare Research — Connector API Integration Guide

Phase 1: Prop AI consumes the **existing** Connector API with a machine API key.
No new public API surface; no connector or worker changes.

## Allowed endpoints (Prop AI)

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/connectors/v1/status` | Provider readiness / connection status |
| `POST` | `/api/connectors/v1/search` | Authenticated portal search |

All other `/api/connectors/v1/**` routes remain **admin session only** (OTP, sessions, providers, health, connect/disconnect).

## CraftSquare environment variables

Set on the CraftSquare Research app host (e.g. Vercel Production):

```bash
PROP_AI_API_KEY=<long-random-secret>
```

Optional query/body field used by both status and search:

- `workspaceId` — defaults to the Research default workspace when omitted.

Prop AI must **not** receive:

- `RESEARCH_BROWSER_WORKER_URL` / public worker URL
- `RESEARCH_ENCRYPTION_KEY` / `AUTH_SECRET`
- `RESEARCH_BROWSER_WORKER_SECRET`
- Portal proxy credentials (`RESEARCH_PORTAL_PROXY_*`, search proxies)
- Any browser / Connect / LiveView secrets

## Prop AI environment variables

```bash
CRAFTSQUARE_RESEARCH_BASE_URL=https://craftsquare.co.in
CRAFTSQUARE_PROP_AI_API_KEY=<same value as CraftSquare PROP_AI_API_KEY>
```

## Authentication flow

1. Prop AI stores `CRAFTSQUARE_PROP_AI_API_KEY` server-side only.
2. Each request to CraftSquare includes **one** of:
   - `Authorization: Bearer <CRAFTSQUARE_PROP_AI_API_KEY>`
   - `x-prop-ai-key: <CRAFTSQUARE_PROP_AI_API_KEY>`
3. CraftSquare compares the presented key to `process.env.PROP_AI_API_KEY` (constant-time).
4. Valid key → request proceeds on **status** or **search** only.
5. Missing Prop AI headers → existing **admin session cookie + Research RBAC** (Research UI unchanged).
6. Invalid Prop AI key → `401` (does **not** fall through to cookies).
7. Prop AI key on any other connector route → ignored for service access; those routes still require admin auth → `401` without a cookie.

## Headers

```http
Authorization: Bearer <PROP_AI_API_KEY>
Content-Type: application/json
```

or:

```http
x-prop-ai-key: <PROP_AI_API_KEY>
Content-Type: application/json
```

## Sample: status

### Request

```http
GET /api/connectors/v1/status?workspaceId=default HTTP/1.1
Host: craftsquare.co.in
Authorization: Bearer <PROP_AI_API_KEY>
```

### Response (`200`)

```json
{
  "ok": true,
  "workspaceId": "default",
  "workerOnline": true,
  "providers": [
    {
      "provider": "housing",
      "displayName": "Housing.com",
      "connection": "connected",
      "health": "healthy",
      "state": "research_ready",
      "stateLabel": "Research Ready",
      "researchReady": true,
      "sessionExists": true,
      "lastValidatedAt": "2026-08-06T12:00:00.000Z",
      "sessionExpiresAt": null,
      "activeConnectSessionId": null,
      "degraded": false,
      "error": null
    }
  ]
}
```

Use `researchReady === true` before searching a provider.

## Sample: search (single provider)

### Request

```http
POST /api/connectors/v1/search HTTP/1.1
Host: craftsquare.co.in
Authorization: Bearer <PROP_AI_API_KEY>
Content-Type: application/json

{
  "provider": "housing",
  "workspaceId": "default",
  "criteria": {
    "city": "Mumbai",
    "locality": "Andheri West",
    "propertyType": "apartment"
  }
}
```

### Response (`200`)

```json
{
  "workspaceId": "default",
  "ok": true,
  "provider": "housing",
  "listings": [],
  "sessionStatus": "valid",
  "message": null,
  "degraded": false
}
```

`listings` is an array of Research listing objects from the existing connector pipeline. Empty `listings` with `ok: false` usually means the portal session is not Research Ready — reconnect in the CraftSquare Research UI (admin), not via Prop AI.

## Sample: search (multi provider)

```http
POST /api/connectors/v1/search HTTP/1.1
Host: craftsquare.co.in
x-prop-ai-key: <PROP_AI_API_KEY>
Content-Type: application/json

{
  "providers": ["housing", "nobroker", "squareyards"],
  "criteria": {
    "city": "Pune",
    "locality": "Baner"
  }
}
```

### Response shape

```json
{
  "ok": true,
  "workspaceId": "default",
  "results": [
    { "ok": true, "provider": "housing", "listings": [], "sessionStatus": "valid" },
    { "ok": false, "provider": "nobroker", "listings": [], "sessionStatus": "error", "message": "..." }
  ],
  "listings": []
}
```

## Error responses

| Status | Meaning |
|--------|---------|
| `401` | Missing/invalid Prop AI key, or missing admin session (admin path) |
| `403` | Admin authenticated but lacks Research permission |
| `400` | Invalid body (e.g. missing `provider` / criteria) |
| `500` | Unexpected server error |

```json
{ "error": "Invalid Prop AI API key." }
```

## How Prop AI should call CraftSquare

1. Prefer server-to-server calls only (never ship the key to browsers).
2. `GET /api/connectors/v1/status` → filter `providers` where `researchReady` is true.
3. `POST /api/connectors/v1/search` with those provider keys and search `criteria`.
4. Do **not** call OTP, sessions, health, providers list/actions, or the browser worker.
5. Portal login / reconnect stays in the CraftSquare Research admin UI.
