import http from 'http';
import {
  handleRemoteHttp,
  handleRemoteUpgrade,
} from '@/lib/research/browser-gateway/remote-display/remote-http';
import {
  buildWorkerStatusPayload,
  getWorkerLogs,
  getWorkerState,
  pushWorkerLog,
  touchWorkerHeartbeat,
} from '@/lib/research/browser-gateway/worker-state';

export type WorkerHttpServer = {
  host: string;
  port: number;
  close: () => Promise<void>;
};

/**
 * Lightweight HTTP control plane for the Browser Worker.
 * Next.js talks to this — Playwright stays in the worker process only.
 * Also serves signed noVNC remote-view routes under /remote/:viewId/*.
 */
export async function startWorkerHttpServer(input: {
  host?: string;
  port: number;
  getQueueStats: () => Promise<{ queueSize: number; activeSessions: number }>;
}): Promise<WorkerHttpServer> {
  const host = input.host || '127.0.0.1';
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url || '/', `http://${host}:${input.port}`);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-research-worker-secret');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    try {
      if (handleRemoteHttp(req, res, url)) return;

      if (url.pathname === '/health' && req.method === 'GET') {
        const state = getWorkerState();
        json(res, 200, {
          ok: Boolean(state?.healthy),
          online: true,
          provider: state?.provider,
          port: input.port,
          lastHeartbeatAt: state?.lastHeartbeatAt,
        });
        return;
      }

      if (url.pathname === '/status' && req.method === 'GET') {
        touchWorkerHeartbeat();
        const stats = await input.getQueueStats();
        let metrics: unknown = null;
        try {
          const { getProductionMetrics } = await import('@/lib/research/ops/metrics');
          metrics = getProductionMetrics();
        } catch {
          /* metrics optional */
        }
        json(res, 200, buildWorkerStatusPayload({ ...stats, metrics }));
        return;
      }

      if (url.pathname === '/metrics' && req.method === 'GET') {
        touchWorkerHeartbeat();
        const { getProductionMetrics, RESEARCH_PROTOCOL_VERSION } = await import(
          '@/lib/research/ops/metrics'
        );
        json(res, 200, {
          ok: true,
          protocolVersion: RESEARCH_PROTOCOL_VERSION,
          metrics: getProductionMetrics(),
        });
        return;
      }

      if (url.pathname === '/heartbeat' && (req.method === 'GET' || req.method === 'POST')) {
        touchWorkerHeartbeat();
        json(res, 200, {
          ok: true,
          at: new Date().toISOString(),
          workerId: getWorkerState()?.workerId,
        });
        return;
      }

      if (url.pathname === '/logs' && req.method === 'GET') {
        const limit = Math.min(Number(url.searchParams.get('limit') || 80), 200);
        json(res, 200, { ok: true, logs: getWorkerLogs(limit) });
        return;
      }

      // Sync validate on the worker (Chromium lives here — never on Vercel).
      if (url.pathname === '/jobs/validate' && req.method === 'POST') {
        if (!authorizeWorkerRequest(req)) {
          json(res, 401, { error: 'Unauthorized' });
          return;
        }
        const body = (await readJsonBody(req)) as {
          workspaceId?: string;
          portal?: string;
          force?: boolean;
        };
        const workspaceId = String(body.workspaceId || '').trim();
        const portal = String(body.portal || '').trim();
        const force = Boolean(body.force);
        if (!workspaceId || !portal) {
          json(res, 400, { error: 'workspaceId and portal are required' });
          return;
        }
        const { requirePortalConnector } = await import('@/connectors/registry');
        const connector = requirePortalConnector(portal);
        pushWorkerLog(
          'info',
          `http_jobs_validate start workspaceId=${workspaceId} portal=${portal} force=${force}`,
        );
        const result = await connector.validateSession(workspaceId, { force });
        pushWorkerLog(
          result.ok ? 'info' : 'warn',
          `http_jobs_validate done workspaceId=${workspaceId} portal=${portal} ok=${result.ok} status=${result.status}`,
        );
        json(res, 200, { ok: result.ok, ...result });
        return;
      }

      // Authenticated portal search on the worker (same encrypted session as Connectors).
      if (url.pathname === '/jobs/search' && req.method === 'POST') {
        if (!authorizeWorkerRequest(req)) {
          json(res, 401, { error: 'Unauthorized' });
          return;
        }
        const body = (await readJsonBody(req)) as {
          workspaceId?: string;
          portal?: string;
          criteria?: Record<string, unknown>;
          sessionId?: string;
          skipValidation?: boolean;
        };
        const workspaceId = String(body.workspaceId || '').trim();
        const portal = String(body.portal || '').trim();
        if (!workspaceId || !portal) {
          json(res, 400, { error: 'workspaceId and portal are required' });
          return;
        }
        const { requirePortalConnector } = await import('@/connectors/registry');
        const connector = requirePortalConnector(portal);
        pushWorkerLog(
          'info',
          `http_jobs_search start workspaceId=${workspaceId} portal=${portal}`,
        );
        const result = await connector.executeSearch({
          workspaceId,
          criteria: (body.criteria || {}) as import('@/lib/research/types').ResearchPlanCriteria,
          sessionId: typeof body.sessionId === 'string' ? body.sessionId : undefined,
          skipValidation: Boolean(body.skipValidation),
        });
        pushWorkerLog(
          result.ok ? 'info' : 'warn',
          `http_jobs_search done workspaceId=${workspaceId} portal=${portal} ok=${result.ok} listings=${result.listings?.length || 0} degraded=${Boolean(result.degraded)}`,
        );
        json(res, 200, result);
        return;
      }

      // Assist Connect OTP: type phone/OTP into the live headed page for an active session.
      if (url.pathname === '/jobs/connect-act' && req.method === 'POST') {
        if (!authorizeWorkerRequest(req)) {
          json(res, 401, { error: 'Unauthorized' });
          return;
        }
        const body = (await readJsonBody(req)) as {
          connectSessionId?: string;
          action?: string;
          phone?: string;
          otp?: string;
        };
        const connectSessionId = String(body.connectSessionId || '').trim();
        const action = String(body.action || '').trim();
        if (!connectSessionId || !action) {
          json(res, 400, { error: 'connectSessionId and action are required' });
          return;
        }
        const { remoteBrowserSessionManager } = await import(
          '@/lib/research/browser-gateway/remote-display/browser-session-manager'
        );
        const page = remoteBrowserSessionManager.getConnectPage(connectSessionId);
        if (!page) {
          json(res, 404, {
            ok: false,
            error: 'No live Connect page for session (expired or not waiting_for_login)',
          });
          return;
        }

        pushWorkerLog(
          'info',
          `http_jobs_connect_act start sessionId=${connectSessionId} action=${action}`,
        );

        if (action === 'fill_phone') {
          const { applyPhoneOnPage } = await import(
            '@/lib/research/browser-gateway/connect-auth-engine'
          );
          const phone = String(body.phone || '');
          let result = await applyPhoneOnPage(page, phone);
          if (!result.ok) {
            // Modal-based portals (NoBroker): open the login surface, retry once.
            const { getConnectSessionById } = await import(
              '@/lib/research/browser-gateway/connect-session-store'
            );
            const { runEnsureConnectLoginSurface } = await import(
              '@/lib/research/browser-gateway/ensure-login-surface'
            );
            const sess = await getConnectSessionById(connectSessionId);
            if (sess) {
              await runEnsureConnectLoginSurface(sess.portal, page);
              result = await applyPhoneOnPage(page, phone);
            }
          }
          await new Promise((r) => setTimeout(r, 1_500));
          json(res, 200, {
            ok: result.ok,
            action,
            filled: result.filled,
            clicked: result.clicked,
            detail: result.detail,
            url: page.url(),
            title: await page.title().catch(() => ''),
          });
          return;
        }

        if (action === 'fill_otp') {
          const { applyOtpOnPage } = await import(
            '@/lib/research/browser-gateway/connect-auth-engine'
          );
          const { updateConnectSession } = await import(
            '@/lib/research/browser-gateway/connect-session-store'
          );
          const otp = String(body.otp || '');
          const result = await applyOtpOnPage(page, otp);
          if (result.ok) {
            await updateConnectSession(connectSessionId, {
              pendingOtp: null,
              pendingOtpAt: null,
              otpAppliedAt: new Date().toISOString(),
              message: 'OTP submitted — verifying…',
              authChallenge: 'none',
            }).catch(() => undefined);
          }
          await new Promise((r) => setTimeout(r, 1_500));
          json(res, 200, {
            ok: result.ok,
            action,
            filled: result.filled,
            clicked: result.clicked,
            detail: result.detail,
            url: page.url(),
            title: await page.title().catch(() => ''),
          });
          return;
        }

        // Force-capture cookies from the live Connect browser even if www is
        // Akamai-blocked (MagicBricks post-OTP). Persists + validates → Connected.
        if (action === 'force_capture') {
          const { getConnectSessionById, updateConnectSession } = await import(
            '@/lib/research/browser-gateway/connect-session-store'
          );
          const { upsertBrowserSession, touchBrowserSession } = await import(
            '@/lib/research/sessions/session-store'
          );
          const { browserSessionManager } = await import(
            '@/lib/research/sessions/browser-session-manager'
          );
          const { transitionConnectSession } = await import(
            '@/lib/research/browser-gateway/connect-phase-machine'
          );
          const { upsertPortalConnection } = await import(
            '@/lib/research/store/portal-connections'
          );
          const sess = await getConnectSessionById(connectSessionId);
          if (!sess) {
            json(res, 404, { ok: false, error: 'connect session not found' });
            return;
          }
          let secrets: {
            encryptedCookies: string;
            encryptedStorage: string;
            cookieCount: number;
            portal: string;
          };
          try {
            secrets = await remoteBrowserSessionManager.captureConnectSecrets(
              connectSessionId,
            );
          } catch (e) {
            json(res, 500, {
              ok: false,
              error: e instanceof Error ? e.message : String(e),
            });
            return;
          }
          if ((secrets.cookieCount || 0) < 1) {
            json(res, 422, {
              ok: false,
              error: 'No cookies in browser context — login may not have completed',
              cookieCount: secrets.cookieCount,
            });
            return;
          }
          // Phase machine: waiting_for_login → verifying → capturing → encrypting → validating → connected
          await transitionConnectSession({
            sessionId: connectSessionId,
            to: 'verifying',
            message: 'Force-capture: treating post-OTP cookies as verified…',
            cookieCount: secrets.cookieCount,
            caller: 'connect-act.force_capture.verify',
          }).catch(() => undefined);
          await transitionConnectSession({
            sessionId: connectSessionId,
            to: 'capturing',
            message: 'Force-capturing session cookies…',
            cookieCount: secrets.cookieCount,
            caller: 'connect-act.force_capture',
          }).catch(() => undefined);
          const browserSession = await upsertBrowserSession({
            workspaceId: sess.workspaceId,
            portal: sess.portal,
            browserProfile: `encrypted:${sess.portal}`,
            encryptedCookies: secrets.encryptedCookies,
            encryptedStorage: secrets.encryptedStorage,
            sessionStatus: 'needs_login',
          });
          await touchBrowserSession(browserSession.id, {
            sessionStatus: 'needs_login',
            status: 'needs_login',
            lastValidationError: 'Awaiting connector validator (force_capture)',
          });
          await transitionConnectSession({
            sessionId: connectSessionId,
            to: 'encrypting',
            message: 'Encrypting force-captured session…',
            browserSessionId: browserSession.id,
            cookieCount: secrets.cookieCount,
            caller: 'connect-act.force_capture.encrypt',
          }).catch(() => undefined);
          await transitionConnectSession({
            sessionId: connectSessionId,
            to: 'validating',
            message: 'Validating force-captured session…',
            browserSessionId: browserSession.id,
            cookieCount: secrets.cookieCount,
            caller: 'connect-act.force_capture.validate',
          }).catch(() => undefined);
          const validation = await browserSessionManager.validateSession(
            browserSession.id,
            { force: true },
          );
          if (!validation.ok) {
            // Still persist cookies — operator can Refresh later. Mark needs_login.
            await updateConnectSession(connectSessionId, {
              phase: 'waiting_for_login',
              message: `Captured ${secrets.cookieCount} cookies but validate failed: ${validation.message || validation.status}. Browser kept open.`,
              browserSessionId: browserSession.id,
              errorMessage: validation.message || validation.status,
            }).catch(() => undefined);
            json(res, 200, {
              ok: false,
              action,
              captured: true,
              cookieCount: secrets.cookieCount,
              browserSessionId: browserSession.id,
              validateOk: false,
              validateMessage: validation.message || validation.status,
              url: page.url(),
              title: await page.title().catch(() => ''),
            });
            return;
          }
          await upsertPortalConnection({
            workspaceId: sess.workspaceId,
            portalKey: sess.portal,
            portalName: sess.portalName || sess.portal,
            status: 'connected',
          }).catch(() => undefined);
          await transitionConnectSession({
            sessionId: connectSessionId,
            to: 'connected',
            message: 'Connected (force-captured after OTP).',
            browserSessionId: browserSession.id,
            cookieCount: secrets.cookieCount,
            validationOk: true,
            finishedAt: new Date().toISOString(),
            caller: 'connect-act.force_capture.connected',
          }).catch(async () => {
            await updateConnectSession(connectSessionId, {
              phase: 'connected',
              message: 'Connected (force-captured after OTP).',
              browserSessionId: browserSession.id,
              finishedAt: new Date().toISOString(),
            });
          });
          json(res, 200, {
            ok: true,
            action,
            captured: true,
            cookieCount: secrets.cookieCount,
            browserSessionId: browserSession.id,
            validateOk: true,
            url: page.url(),
            title: await page.title().catch(() => ''),
          });
          return;
        }

        if (action === 'snapshot') {
          json(res, 200, {
            ok: true,
            action,
            url: page.url(),
            title: await page.title().catch(() => ''),
          });
          return;
        }

        // Diagnostic: fill phone, submit, and capture the network traffic so we can
        // see exactly whether the portal's "send OTP" request fires and what it
        // returns (captcha-required / rate-limit / password-only / success).
        if (action === 'phone_trace') {
          const phone = String(body.phone || '');
          const captured: Array<Record<string, unknown>> = [];
          const interesting =
            /otp|sms|login|signin|sign-in|auth|verify|mobile|sendcode|send-code|generatecode|user|account/i;
          const onResponse = (resp: import('playwright').Response) => {
            try {
              const u = resp.url();
              const status = resp.status();
              if (!interesting.test(u) && status < 400) return;
              const ct = resp.headers()['content-type'] || '';
              const rec: Record<string, unknown> = {
                method: resp.request().method(),
                url: u.slice(0, 180),
                status,
                contentType: ct.slice(0, 60),
              };
              if (/json|text/i.test(ct)) {
                resp
                  .text()
                  .then((t) => {
                    rec.bodyHead = t.slice(0, 300);
                  })
                  .catch(() => undefined);
              }
              captured.push(rec);
            } catch {
              /* ignore */
            }
          };
          const onFailed = (reqf: import('playwright').Request) => {
            try {
              const u = reqf.url();
              if (!interesting.test(u)) return;
              captured.push({
                method: reqf.method(),
                url: u.slice(0, 180),
                failure: reqf.failure()?.errorText || 'failed',
              });
            } catch {
              /* ignore */
            }
          };
          page.on('response', onResponse);
          page.on('requestfailed', onFailed);
          const { applyPhoneOnPage } = await import(
            '@/lib/research/browser-gateway/connect-auth-engine'
          );
          const urlBefore = page.url();
          const result = await applyPhoneOnPage(page, phone);
          await new Promise((r) => setTimeout(r, 9_000));
          page.off('response', onResponse);
          page.off('requestfailed', onFailed);
          json(res, 200, {
            ok: result.ok,
            action,
            phoneResult: result,
            urlBefore,
            urlAfter: page.url(),
            title: await page.title().catch(() => ''),
            network: captured.slice(0, 60),
          });
          return;
        }

        // Diagnostic: dump every input element (incl. inside frames) with attributes.
        if (action === 'dump_inputs') {
          const collect = async (frame: import('playwright').Frame) => {
            return frame
              .evaluate(() => {
                const rows: Array<{
                  attrs: Record<string, string>;
                  value: string;
                  visible: boolean;
                  w: number;
                  h: number;
                  kind: string;
                }> = [];
                const push = (el: Element, kind: string) => {
                  const r = (el as HTMLElement).getBoundingClientRect();
                  const attrs: Record<string, string> = {};
                  for (const a of Array.from(el.attributes)) attrs[a.name] = a.value;
                  const value =
                    kind === 'contenteditable'
                      ? (el.textContent || '').trim()
                      : ((el as HTMLInputElement).value || '');
                  rows.push({
                    attrs,
                    value,
                    visible: r.width > 0 && r.height > 0,
                    w: Math.round(r.width),
                    h: Math.round(r.height),
                    kind,
                  });
                };
                for (const el of Array.from(document.querySelectorAll('input'))) {
                  push(el, 'input');
                }
                for (const el of Array.from(
                  document.querySelectorAll('[contenteditable="true"], [contenteditable=""]'),
                )) {
                  push(el, 'contenteditable');
                }
                return rows;
              })
              .catch(() => []);
          };
          const all: unknown[] = [];
          for (const fr of page.frames()) {
            const rows = await collect(fr);
            if (rows.length) all.push({ frameUrl: fr.url().slice(0, 120), inputs: rows });
          }
          json(res, 200, { ok: true, action, url: page.url(), frames: all });
          return;
        }

        // Live page screenshot (base64) — lets the operator see CAPTCHA/state in chat.
        if (action === 'page_screenshot') {
          const buf = await page
            .screenshot({ type: 'jpeg', quality: 70 })
            .catch(() => null);
          if (!buf) {
            json(res, 500, { ok: false, error: 'screenshot failed' });
            return;
          }
          json(res, 200, {
            ok: true,
            action,
            url: page.url(),
            title: await page.title().catch(() => ''),
            imageBase64: buf.toString('base64'),
          });
          return;
        }

        // Coordinate-based interaction — works even when inputs live in
        // shadow DOM / canvas overlays that CSS selectors cannot reach.
        // Coordinates map 1:1 to the viewport screenshot from page_screenshot.
        if (action === 'click_xy') {
          const b = body as { x?: number; y?: number };
          const x = Number(b.x);
          const y = Number(b.y);
          if (!Number.isFinite(x) || !Number.isFinite(y)) {
            json(res, 400, { ok: false, error: 'x and y required' });
            return;
          }
          await page.mouse.click(x, y);
          json(res, 200, { ok: true, action, x, y, url: page.url() });
          return;
        }

        // Click by CSS/text selector (visible). Prefer over click_xy for labeled links.
        if (action === 'click_selector') {
          const selector = String((body as { selector?: string }).selector || '').trim();
          if (!selector) {
            json(res, 400, { ok: false, error: 'selector required' });
            return;
          }
          const loc = page.locator(selector).first();
          if ((await loc.count().catch(() => 0)) === 0) {
            json(res, 404, { ok: false, action, error: `selector not found: ${selector}` });
            return;
          }
          await loc.click({ timeout: 5_000, force: true });
          await new Promise((r) => setTimeout(r, 800));
          json(res, 200, {
            ok: true,
            action,
            selector,
            url: page.url(),
            title: await page.title().catch(() => ''),
          });
          return;
        }

        // MagicBricks: voice OTP — calls window.resendOtp(true) (same as "Verify on Call").
        if (action === 'mb_verify_on_call' || action === 'verify_on_call') {
          const result = await page
            .evaluate(() => {
              const w = window as unknown as { resendOtp?: (onCall?: boolean) => void };
              const link = document.querySelector(
                '#smsCodeSentOnCall a, a[onclick*="resendOtp(true)"]',
              ) as HTMLAnchorElement | null;
              if (typeof w.resendOtp === 'function') {
                w.resendOtp(true);
                return { mode: 'resendOtp(true)', hasLink: Boolean(link) };
              }
              if (link) {
                link.click();
                return { mode: 'link.click', hasLink: true };
              }
              return { mode: 'miss', hasLink: false };
            })
            .catch((e) => ({ mode: 'error', error: String(e) }));
          await new Promise((r) => setTimeout(r, 1_500));
          json(res, 200, {
            ok: result.mode !== 'miss' && result.mode !== 'error',
            action,
            ...result,
            url: page.url(),
            title: await page.title().catch(() => ''),
          });
          return;
        }

        // Type text via keyboard into whatever element currently has focus.
        if (action === 'type_text') {
          const text = String((body as { text?: string }).text || '');
          if (!text) {
            json(res, 400, { ok: false, error: 'text required' });
            return;
          }
          await page.keyboard.type(text, { delay: 90 });
          json(res, 200, { ok: true, action, typed: text.length, url: page.url() });
          return;
        }

        // Type a human-solved CAPTCHA code into the visible captcha field.
        // MagicBricks uses a contenteditable DIV (#captchaCodeSignIn), not an <input>.
        if (action === 'fill_captcha') {
          const code = String((body as { captcha?: string }).captcha || '').trim();
          if (!code) {
            json(res, 400, { ok: false, error: 'captcha code required' });
            return;
          }
          let used: string | null = null;
          let deep: Record<string, unknown> | null = null;

          // 1) MagicBricks contenteditable captcha (primary path).
          const mbSelectors = [
            '#captchaCodeSignIn',
            '[name="captchaCodeSignIn"]',
            '#captchaDivSignIn [contenteditable]',
            '.signup__captcha--input[contenteditable]',
            '[contenteditable][name*="captcha" i]',
            '[contenteditable][id*="captcha" i]',
          ];
          for (const sel of mbSelectors) {
            const loc = page.locator(sel).first();
            if ((await loc.count().catch(() => 0)) === 0) continue;
            if (!(await loc.isVisible().catch(() => false))) continue;
            try {
              await loc.click({ timeout: 3_000 });
              // Clear then type — MagicBricks reads textContent / key events.
              await page.keyboard.press('Control+A').catch(() => undefined);
              await page.keyboard.press('Backspace').catch(() => undefined);
              await page.keyboard.type(code, { delay: 50 });
              await loc
                .evaluate((el, expected) => {
                  const text = (el.textContent || '').replace(/\s+/g, '');
                  if (text === expected) return true;
                  el.textContent = expected;
                  el.dispatchEvent(new Event('input', { bubbles: true }));
                  el.dispatchEvent(new Event('change', { bubbles: true }));
                  el.dispatchEvent(new Event('blur', { bubbles: true }));
                  return (el.textContent || '').replace(/\s+/g, '') === expected;
                }, code)
                .catch(() => false);
              used = `mb-contenteditable:${sel}`;
              break;
            } catch {
              /* try next */
            }
          }

          // 2) Conventional <input> captcha fields.
          if (!used) {
            const selectors = [
              'input[name*="captcha" i]',
              'input[id*="captcha" i]',
              'input[placeholder*="captcha" i]',
              'input[formcontrolname*="captcha" i]',
              'input[ng-reflect-name*="captcha" i]',
              'input[aria-label*="captcha" i]',
              'input[placeholder*="code" i]:not([type="hidden"])',
            ];
            for (const sel of selectors) {
              const loc = page.locator(sel).first();
              if ((await loc.count().catch(() => 0)) === 0) continue;
              if (!(await loc.isVisible().catch(() => false))) continue;
              try {
                await loc.fill(code, { timeout: 5_000 });
                used = sel;
                break;
              } catch {
                /* try next */
              }
            }
          }

          // 3) Heuristic: short empty visible text input that is not phone/email.
          if (!used) {
            const inputs = page.locator(
              'input[type="text"]:visible, input:not([type]):visible, input[type="tel"]:visible',
            );
            const n = await inputs.count().catch(() => 0);
            for (let i = 0; i < n; i += 1) {
              const loc = inputs.nth(i);
              const val = await loc.inputValue().catch(() => 'x');
              const nameAttr = (await loc.getAttribute('name').catch(() => '')) || '';
              const idAttr = (await loc.getAttribute('id').catch(() => '')) || '';
              if (/mobile|phone|email/i.test(`${nameAttr} ${idAttr}`)) continue;
              if (val && val.trim().length > 0) continue;
              try {
                await loc.fill(code, { timeout: 5_000 });
                used = `heuristic:input#${i}`;
                break;
              } catch {
                /* next */
              }
            }
          }

          // 4) Deep DOM: shadow walk + captcha image geometry (id/class/src/bg).
          if (!used) {
            deep = await page
              .evaluate((captchaCode) => {
                const walk = (root: ParentNode): Element[] => {
                  const out: Element[] = [];
                  const nodes = Array.from(root.querySelectorAll('*'));
                  for (const n of nodes) {
                    out.push(n);
                    const sr = (n as HTMLElement & { shadowRoot?: ShadowRoot | null }).shadowRoot;
                    if (sr) out.push(...walk(sr));
                  }
                  return out;
                };
                const all = walk(document);

                let imgRect: DOMRect | null = null;
                for (const el of all) {
                  if (el.tagName !== 'IMG') continue;
                  const html = el as HTMLImageElement;
                  const blob = `${html.id} ${html.className} ${html.src || ''} ${html.alt || ''}`.toLowerCase();
                  const r = html.getBoundingClientRect();
                  if (r.width < 20 || r.height < 10) continue;
                  if (/captcha|simplecaptcha/.test(blob)) {
                    imgRect = r;
                    break;
                  }
                }
                if (!imgRect) {
                  for (const el of all) {
                    try {
                      const bg = getComputedStyle(el).backgroundImage || '';
                      const blob = `${(el as HTMLElement).id} ${(el as HTMLElement).className} ${bg}`.toLowerCase();
                      if (!/captcha|simplecaptcha/.test(blob)) continue;
                      const r = (el as HTMLElement).getBoundingClientRect();
                      if (r.width > 20 && r.height > 10) {
                        imgRect = r;
                        break;
                      }
                    } catch {
                      /* ignore */
                    }
                  }
                }

                const fillEditable = (target: HTMLElement, mode: string) => {
                  target.focus();
                  if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
                    (target as HTMLInputElement).value = captchaCode;
                  } else {
                    target.textContent = captchaCode;
                  }
                  target.dispatchEvent(new Event('input', { bubbles: true }));
                  target.dispatchEvent(new Event('change', { bubbles: true }));
                  return {
                    mode: 'dom',
                    kind: mode,
                    score: 999,
                    img: imgRect
                      ? { x: imgRect.x, y: imgRect.y, w: imgRect.width, h: imgRect.height }
                      : null,
                  };
                };

                // Prefer known MagicBricks contenteditable.
                const mb = document.getElementById('captchaCodeSignIn') as HTMLElement | null;
                if (mb) return fillEditable(mb, 'captchaCodeSignIn');

                const candidates: Array<{ el: HTMLElement; score: number; kind: string }> = [];
                for (const el of all) {
                  const html = el as HTMLElement;
                  if (html.tagName === 'INPUT') {
                    const type = (html.getAttribute('type') || 'text').toLowerCase();
                    if (
                      ['hidden', 'radio', 'checkbox', 'password', 'submit', 'button'].includes(type)
                    )
                      continue;
                    const id = `${html.id} ${html.getAttribute('name') || ''} ${html.className}`.toLowerCase();
                    if (/mobile|phone|email|password|remember|usertype|otp|verify0/.test(id))
                      continue;
                    if (((html as HTMLInputElement).value || '').trim().length > 0) continue;
                    const r = html.getBoundingClientRect();
                    if (r.width < 8 || r.height < 8) continue;
                    let score = r.width < 220 && r.width > 8 ? 40 : 5;
                    if (imgRect) {
                      const dx = Math.abs(r.left - imgRect.right);
                      const dy = Math.abs(r.top - imgRect.top);
                      score = 2000 - (dx + dy * 2);
                    }
                    candidates.push({ el: html, score, kind: 'input' });
                  } else if (html.isContentEditable || html.getAttribute('role') === 'textbox') {
                    const id = `${html.id} ${html.getAttribute('name') || ''} ${html.className}`.toLowerCase();
                    const r = html.getBoundingClientRect();
                    if (r.width < 8 || r.height < 8) continue;
                    let score = /captcha/.test(id) ? 500 : 20;
                    if (imgRect) {
                      const dx = Math.abs(r.left - imgRect.right);
                      const dy = Math.abs(r.top - imgRect.top);
                      score = Math.max(score, 1500 - (dx + dy * 2));
                    }
                    candidates.push({ el: html, score, kind: 'editable' });
                  }
                }
                candidates.sort((a, b) => b.score - a.score);
                const best = candidates[0];
                if (best && best.score > 100) {
                  return fillEditable(best.el, best.kind);
                }
                if (imgRect) {
                  return {
                    mode: 'click_xy',
                    kind: 'geom',
                    score: best ? best.score : 0,
                    img: {
                      x: imgRect.x,
                      y: imgRect.y,
                      w: imgRect.width,
                      h: imgRect.height,
                    },
                    click: {
                      x: Math.round(imgRect.right + 48),
                      y: Math.round(imgRect.top + Math.max(imgRect.height, 20) / 2),
                    },
                  };
                }
                return {
                  mode: 'miss',
                  kind: 'none',
                  score: 0,
                  img: null,
                  candidateCount: candidates.length,
                };
              }, code)
              .catch((e) => ({ mode: 'error', error: String(e) }));

            if (deep?.mode === 'dom') {
              used = `deep-${String(deep.kind)}:score=${String(deep.score)}`;
            } else if (
              deep?.mode === 'click_xy' &&
              deep.click &&
              typeof deep.click === 'object' &&
              deep.click !== null &&
              'x' in deep.click &&
              'y' in deep.click
            ) {
              const click = deep.click as { x: number; y: number };
              await page.mouse.click(click.x, click.y);
              await page.keyboard.type(code, { delay: 60 });
              used = `geom-click:${click.x},${click.y}`;
            }
          }

          let clicked: string | null = null;
          if (used) {
            for (const sel of [
              'button#btnStep1',
              'button:has-text("Next")',
              'button:has-text("Login")',
              'button:has-text("Sign In")',
              'button:has-text("Continue")',
              'button[type="submit"]',
            ]) {
              const loc = page.locator(sel).first();
              if ((await loc.count().catch(() => 0)) === 0) continue;
              if (!(await loc.isVisible().catch(() => false))) continue;
              try {
                await loc.click({ timeout: 5_000 });
                clicked = sel;
                break;
              } catch {
                /* try next */
              }
            }
          }
          await new Promise((r) => setTimeout(r, 1_500));
          json(res, 200, {
            ok: Boolean(used),
            action,
            filled: Boolean(used),
            input: used,
            clicked,
            deep: deep || undefined,
            url: page.url(),
            title: await page.title().catch(() => ''),
          });
          return;
        }

        // Recover from WAF/redirect dead-ends without burning the session:
        // re-navigate the live page to the portal's own login URL or origin only.
        if (action === 'goto_login' || action === 'goto_origin') {
          const { getConnectSessionById } = await import(
            '@/lib/research/browser-gateway/connect-session-store'
          );
          const { getPortalMeta } = await import('@/lib/research/browser/config');
          const sess = await getConnectSessionById(connectSessionId);
          const meta = sess ? getPortalMeta(sess.portal) : null;
          const target =
            action === 'goto_login' ? meta?.loginUrl : meta?.origin;
          if (!target) {
            json(res, 404, { ok: false, error: 'Portal login URL unavailable' });
            return;
          }
          const { resilientPageGoto } = await import('@/lib/research/browser/resilient-goto');
          const nav = await resilientPageGoto(page, target, { maxAttempts: 2 });
          json(res, 200, {
            ok: !nav.error,
            action,
            target,
            navError: nav.error,
            url: page.url(),
            title: await page.title().catch(() => ''),
          });
          return;
        }

        // Navigate the live page to an operator-supplied URL, restricted to the
        // session portal's own registrable domain (WAF diagnosis / recovery).
        if (action === 'goto_url') {
          const target = String((body as { url?: string }).url || '').trim();
          if (!target) {
            json(res, 400, { ok: false, error: 'url required' });
            return;
          }
          const { getConnectSessionById } = await import(
            '@/lib/research/browser-gateway/connect-session-store'
          );
          const { getPortalMeta } = await import('@/lib/research/browser/config');
          const sess = await getConnectSessionById(connectSessionId);
          const meta = sess ? getPortalMeta(sess.portal) : null;
          const portalHost = meta ? new URL(meta.origin).hostname.replace(/^www\./, '') : '';
          let targetHost = '';
          try {
            targetHost = new URL(target).hostname;
          } catch {
            json(res, 400, { ok: false, error: 'invalid url' });
            return;
          }
          if (!portalHost || !targetHost.endsWith(portalHost)) {
            json(res, 403, { ok: false, error: `url must be on ${portalHost}` });
            return;
          }
          const { resilientPageGoto } = await import('@/lib/research/browser/resilient-goto');
          const nav = await resilientPageGoto(page, target, { maxAttempts: 2 });
          json(res, 200, {
            ok: !nav.error,
            action,
            target,
            navError: nav.error,
            url: page.url(),
            title: await page.title().catch(() => ''),
          });
          return;
        }

        // Probe HTTP statuses from the worker's network/IP using the browser
        // context's request stack (real cookies + TLS). No page navigation.
        if (action === 'probe_http') {
          const urls = (body as { urls?: string[] }).urls;
          const list = Array.isArray(urls) ? urls.slice(0, 8).map(String) : [];
          if (!list.length) {
            json(res, 400, { ok: false, error: 'urls[] required' });
            return;
          }
          const results: Array<Record<string, unknown>> = [];
          for (const u of list) {
            try {
              const resp = await page.request.get(u, {
                timeout: 20_000,
                maxRedirects: 5,
              });
              const bodyText = await resp.text().catch(() => '');
              results.push({
                url: u,
                status: resp.status(),
                finalUrl: resp.url(),
                server: resp.headers()['server'] || null,
                bodyBytes: bodyText.length,
                bodyHead: bodyText.slice(0, 200),
              });
            } catch (e) {
              results.push({ url: u, error: e instanceof Error ? e.message : String(e) });
            }
          }
          json(res, 200, { ok: true, action, results });
          return;
        }

        json(res, 400, { ok: false, error: `Unknown action: ${action}` });
        return;
      }

      // Debug inspect: load authenticated session, open search URL, report DOM signals.
      if (url.pathname === '/jobs/inspect-search' && req.method === 'POST') {
        if (!authorizeWorkerRequest(req)) {
          json(res, 401, { error: 'Unauthorized' });
          return;
        }
        const body = (await readJsonBody(req)) as {
          workspaceId?: string;
          portal?: string;
          url?: string;
        };
        const workspaceId = String(body.workspaceId || '').trim();
        const portal = String(body.portal || '').trim();
        const targetUrl = String(body.url || '').trim();
        if (!workspaceId || !portal || !targetUrl) {
          json(res, 400, { error: 'workspaceId, portal, and url are required' });
          return;
        }
        const { findBrowserSession } = await import('@/lib/research/sessions/session-store');
        const { researchBrowserManager } = await import('@/lib/research/browser/browser-manager');
        const session = await findBrowserSession(workspaceId, portal);
        if (!session?.encryptedCookies) {
          json(res, 200, {
            ok: false,
            error: 'No encrypted cookies for portal session',
            sessionStatus: session?.sessionStatus || null,
          });
          return;
        }
        pushWorkerLog('info', `http_jobs_inspect_search portal=${portal} url=${targetUrl}`);
        const outcome = await researchBrowserManager.withPage(
          session,
          `inspect-${portal}`,
          async (page) => {
            const response = await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });
            await new Promise((r) => setTimeout(r, 2_500));
            const httpStatus = response?.status() ?? null;
            const title = await page.title().catch(() => '');
            const finalUrl = page.url();
            const html = await page.content().catch(() => '');
            const signals = await page.evaluate(() => {
              const anchors = Array.from(document.querySelectorAll('a[href]'));
              const hrefs = anchors.map((a) => (a as HTMLAnchorElement).href).filter(Boolean);
              const propertyRe = /property|\/rent|\/buy|flat|apartment|resale/i;
              const property = hrefs.filter((h) => propertyRe.test(h));
              return {
                totalAnchorCount: hrefs.length,
                propertyAnchorCount: property.length,
                sampleHrefs: Array.from(new Set(property.length ? property : hrefs)).slice(0, 12),
                bodyTextSample: (document.body?.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 400),
              };
            });
            const securityChallenge = /security|challenge|access denied|captcha|akamai/i.test(
              `${title} ${signals.bodyTextSample}`,
            );
            return {
              ok: true,
              httpStatus,
              title,
              finalUrl,
              requestedUrl: targetUrl,
              htmlLength: html.length,
              securityChallenge,
              ...signals,
            };
          },
        );
        if (outcome.error) {
          json(res, 200, { ok: false, error: outcome.error.message });
          return;
        }
        json(res, 200, outcome.result);
        return;
      }

      json(res, 404, { error: 'Not found' });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      pushWorkerLog('error', `HTTP handler failed: ${message}`);
      json(res, 500, { error: message });
    }
  });

  server.on('upgrade', (req, socket, head) => {
    if (handleRemoteUpgrade(req, socket, head)) return;
    socket.destroy();
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(input.port, host, () => resolve());
  });

  pushWorkerLog('info', `HTTP control plane listening on http://${host}:${input.port}`);

  return {
    host,
    port: input.port,
    close: () =>
      new Promise((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      }),
  };
}

function authorizeWorkerRequest(req: http.IncomingMessage): boolean {
  const secret = process.env.RESEARCH_BROWSER_WORKER_SECRET?.trim();
  if (!secret) return true;
  return req.headers['x-research-worker-secret'] === secret;
}

async function readJsonBody(req: http.IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    return {};
  }
}

function json(res: http.ServerResponse, status: number, body: unknown) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
  });
  res.end(payload);
}
