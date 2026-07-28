# Invariants-only — pr-1785158952211
- [x] happy_path_queued_to_connecting: allowed=connecting|cancelled|expired|failed
- [x] happy_path_connecting_to_opening_browser: allowed=opening_browser|validating|cancelled|expired|failed
- [x] happy_path_opening_browser_to_waiting_for_login: allowed=waiting_for_login|cancelled|expired|failed
- [x] happy_path_waiting_for_login_to_verifying: allowed=verifying|cancelled|expired|failed
- [x] happy_path_verifying_to_capturing: allowed=capturing|failed|cancelled|expired
- [x] happy_path_capturing_to_encrypting: allowed=encrypting|failed|cancelled|expired
- [x] happy_path_encrypting_to_connected: allowed=connected|failed|cancelled|expired
- [x] waiting_for_login_not_to_validating: allowed=verifying|cancelled|expired|failed
- [x] waiting_for_login_to_verifying: allowed=verifying|cancelled|expired|failed
- [x] encrypting_to_connected: allowed=connected|failed|cancelled|expired
- [x] auth_engine_magicbricks_like_pass: confidence=100 authenticated=true
- [x] verifyUrl_safe_housing: loginUrl=https://housing.com/user-profile verifyUrl=https://housing.com/user-profile
- [x] verifyUrl_safe_magicbricks: loginUrl=https://accounts.magicbricks.com/userauth/login verifyUrl=https://www.magicbricks.com/
- [x] verifyUrl_safe_99acres: loginUrl=https://www.99acres.com/login-lrfv verifyUrl=https://www.99acres.com/
- [x] verifyUrl_safe_nobroker: loginUrl=https://www.nobroker.in/ verifyUrl=https://www.nobroker.in/
- [x] verifyUrl_safe_squareyards: loginUrl=https://www.squareyards.com/user/login verifyUrl=https://www.squareyards.com/

## Code review
### 1. Memory leaks
connectorRuntime Map and BrowserPool entries grow per workspace::portal and are only cleared via explicit cleanup/close. Long-lived worker with many workspaces can retain runtime snapshots forever.
### 2. Browser/context leaks
acquire() waits up to 60s for inUse; if a caller crashes mid-withPage without finally release, context stays inUse until timeout then throws busy.
### 3. Zombie Chromium
Worker SIGKILL (OOM/deploy) can leave Chromium + Xvfb/x11vnc orphans; connect profiles may remain until cleanupExpiredProfiles runs.
### 4. Orphaned browser profiles
Connect profile dirs removed in finally, but crash between prepareConnectProfileDir and finally can orphan dirs under profile root.
### 5. Deadlocks
Profile lock + pool inUse spin-wait could interact poorly if same portal Connect and search overlap on different locks.
### 6. Race conditions
Superseding Connect cancels prior active sessions in Mongo, but in-flight worker may still finish and write connected after cancel if not checking phase often enough.
### 7. Unhandled promise rejections
Many .catch(() => undefined) swallow errors on close/cleanup — good for shutdown, bad for observability if close fails silently.
### 8. Retry loops
processNextConnectJob still has while(true) for Connect; after architecture change success returns, but launch retry + browser launch failure paths must not loop forever without backoff.
### 9. Database consistency
Portal connection status and browser session status can diverge (e.g. portal connected but cookies cleared). Status UI merges both — operators can see Connected while search fails.
### 10. Cleanup failures
finally removes profileDir even after successful path cleared profileDir=""; good. Failed close of Chromium may leave processes while Mongo says failed.

## 30-day risks
1. Portal bot wall / Akamai / captcha after cookie restore (headless or IP reputation) (high/high)
2. Session cookie expiry / silent logout while UI still shows Connected (fresh validate skip window) (high/high)
3. Chromium crash mid-search → empty listings / false research quality (medium/high)
4. Disk fill from screenshots/HTML auth traces/profiles (medium/critical)
5. Mongo cold start / auth null causing intermittent 401 on research APIs (medium/medium)
6. Worker deploy SIGKILL leaves zombie Chromium + orphan profiles (medium/high)
7. Connect phase / worker code drift after deploy (old worker + new phases) (medium/critical)
8. Generic listing parsers return 0 results → research looks broken though auth OK (high/medium)
9. Encryption key rotation invalidates all encrypted storageState (low/critical)
10. Pool inUse stuck + concurrent research jobs starve a portal (low/medium)