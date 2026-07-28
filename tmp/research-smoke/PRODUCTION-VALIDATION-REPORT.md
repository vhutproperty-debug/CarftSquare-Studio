# Production connector validation report

**Commit:** `78b81be` (worker SUCCESS)  
**Generated:** 2026-07-27T19:01Z  
**Workspace:** `workspace-default`

## Summary

| Portal | Connect surface | Encrypted session | validateSession | executeSearch | Research Ready | Status |
|--------|-----------------|-------------------|-----------------|---------------|----------------|--------|
| Housing | OK (frozen) | Yes | Pass | 29 listings | **PASS** | Production validated — unchanged |
| MagicBricks | waiting_for_login + liveView | No | Blocked (no session) | Blocked | **PENDING OTP** | Connect path healthy |
| 99acres | Fail (WAF) | No | Blocked | Blocked | **FAIL (external)** | Railway IP blocked on all probed URLs |
| NoBroker | Connect path OK (prior smoke) | No | Blocked | Blocked | **PENDING OTP** | Needs Connect after MagicBricks |
| Square Yards | Connect path OK (prior smoke) | No | Blocked | Blocked | **PENDING OTP** | Needs Connect after MagicBricks |

## Evidence by portal

### Housing — PASS
- Session cookies+storage present; `displayState=connected`; `availableForResearch=true`
- Post-fix smoke (`78b81be`): validate `valid`, search **29 listings** (Oberoi / 3 BHK)
- Must remain unchanged unless regression

### MagicBricks — PENDING human OTP
- Divergence vs Housing: **no encryptedCookies** (TTL expired Jul 25; cookies previously wiped by hard Reconnect→Disconnect)
- Connect now at `waiting_for_login` with live VNC
  - sessionId: `d87eb2ae-6bd6-4e2b-9cd0-9b95022fea64`
  - expiresAt: `2026-07-27T19:20:28.012Z`
- Login surface confirmed (accounts.magicbricks.com, authScore polling, loginForm present)

### 99acres — FAIL (WAF / IP block)
- Connect repeatedly: `Portal blocked this login page (security / WAF)`
- Worker inspect from Housing context:
  - `https://www.99acres.com/` → `ERR_HTTP_RESPONSE_CODE_FAILURE`
  - `/login-lrfv` → same
  - `/robots.txt` → same
  - `m.99acres.com` → `ERR_NAME_NOT_RESOLVED`
- **No connector/code change can clear this** without residential egress or Browserbase (`RESEARCH_BROWSERBASE_WS` unset)
- False Connected: not observed — correctly `session_expired` / failed Connect

### NoBroker / Square Yards — PENDING OTP
- Prior Connect smoke reached `waiting_for_login` then cancelled (smoke does not complete OTP)
- Same root cause as MagicBricks: missing encrypted session secrets
- Connector login surfaces exist (NoBroker modal via `ensureConnectLoginSurface`; Square Yards `/user/login`)

## Code fixes shipped this pass (`78b81be`)

1. **Soft Reconnect** — no longer calls Disconnect wipe of `encryptedCookies`/`encryptedStorage`
2. **Expire stale Connect** when listing connector statuses (stops false permanent “Connecting…”)
3. **verifyUrl probe during login wait** — reduces MagicBricks false login_timeout after OTP while still on accounts DOM

## Hard blockers remaining (not code bugs)

1. **Human OTP** required for MagicBricks, NoBroker, Square Yards (and 99acres once WAF cleared)
2. **99acres Railway IP WAF** — requires Browserbase / residential proxy

## Operator action (required to reach Research Ready)

1. Open MagicBricks liveView **now** (before expiresAt) and complete OTP  
2. After Connected → run: `npx tsx scripts/smoke-research-production.ts --portals=magicbricks`  
3. Repeat Connect+OTP for `nobroker`, then `squareyards`  
4. For 99acres: configure `RESEARCH_BROWSER_PROVIDER=browserbase` + `RESEARCH_BROWSERBASE_WS` (or residential proxy), then Connect+OTP
