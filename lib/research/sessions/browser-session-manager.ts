import type { SessionManager } from '@/agents/session-manager';
import { connectorLog } from '@/lib/research/browser/connector-log';
import { researchBrowserManager } from '@/lib/research/browser/browser-manager';
import { getPortalMeta, RESEARCH_BROWSER_CONFIG } from '@/lib/research/browser/config';
import { PageManager } from '@/lib/research/browser/page-manager';
import { researchPerfLog, researchPerfNow } from '@/lib/research/browser/perf';
import {
  findBrowserSession,
  getBrowserSessionById,
  listBrowserSessions,
  touchBrowserSession,
  upsertBrowserSession,
} from '@/lib/research/sessions/session-store';
import type { ResearchBrowserSession, ResearchBrowserSessionStatus } from '@/lib/research/types';

type ValidationProbe = {
  httpStatus: number | null;
  finalUrl: string;
  title: string;
  bodySnippet: string;
  kind: '200' | '401' | '403' | '406' | 'timeout' | 'network_error' | 'other' | 'exception';
  authenticated: boolean;
  message?: string;
  loginConfidence?: number;
};

function classifyHttpStatus(status: number | null): ValidationProbe['kind'] {
  if (status === 200) return '200';
  if (status === 401) return '401';
  if (status === 403) return '403';
  if (status === 406) return '406';
  return 'other';
}

function classifyException(message: string): ValidationProbe['kind'] {
  if (/timeout/i.test(message)) return 'timeout';
  if (/net::|ENOTFOUND|ECONNRESET|ECONNREFUSED|ERR_/i.test(message)) return 'network_error';
  return 'exception';
}

/** Browser/page lifecycle failures must propagate so withPage can invalidate + retry. */
function isBrowserLifecycleError(message: string): boolean {
  return /page crashed|target closed|has been closed|browser.*(closed|disconnected)|execution context (was )?destroyed|session closed|destroyed/i.test(
    message,
  );
}

function isSecurityChallenge(status: number | null, title: string, body: string): boolean {
  if (status === 406) return true;
  const t = title.toLowerCase();
  const b = body.toLowerCase();
  return t.includes('security alert') || b.includes('security alert') || b.includes('access denied');
}

/**
 * Production Browser Session Manager — persistent profiles, encrypted secrets,
 * validation, refresh, multi-portal + workspace isolation.
 */
export class BrowserSessionManager implements SessionManager {
  readonly name = 'SessionManager' as const;
  private readonly pages = new PageManager();

  async get(sessionId: string): Promise<ResearchBrowserSession | null> {
    return getBrowserSessionById(sessionId);
  }

  async list(workspaceId: string): Promise<ResearchBrowserSession[]> {
    return listBrowserSessions(workspaceId);
  }

  async getOrCreate(workspaceId: string, portal: string): Promise<ResearchBrowserSession> {
    const existing = await findBrowserSession(workspaceId, portal);
    if (existing) return existing;
    const browserProfile = researchBrowserManager.profilePath(workspaceId, portal);
    return upsertBrowserSession({
      workspaceId,
      portal,
      browserProfile,
      sessionStatus: 'needs_login',
    });
  }

  async renew(sessionId: string): Promise<ResearchBrowserSession> {
    const session = await getBrowserSessionById(sessionId);
    if (!session) throw new Error('Browser session not found.');
    const secrets = await researchBrowserManager.captureSessionSecrets(session);
    const updated = await upsertBrowserSession({
      workspaceId: session.workspaceId,
      portal: session.portal,
      browserProfile: session.browserProfile,
      encryptedCookies: secrets.encryptedCookies,
      encryptedStorage: secrets.encryptedStorage,
      sessionStatus: 'valid',
      lastVerified: new Date().toISOString(),
    });
    return updated;
  }

  async expire(sessionId: string): Promise<void> {
    await touchBrowserSession(sessionId, {
      sessionStatus: 'needs_login',
      status: 'needs_login',
      lastValidationError: 'Session expired — reconnect required',
    });
  }

  async validateSession(
    sessionId: string,
    options?: { force?: boolean },
  ): Promise<{
    ok: boolean;
    status: ResearchBrowserSessionStatus;
    message?: string;
    httpStatus?: number | null;
    responseKind?: ValidationProbe['kind'];
    loginConfidence?: number;
    /** True when the freshness cache short-circuited a live Chromium check. */
    skippedFresh?: boolean;
  }> {
    const t0 = researchPerfNow();
    const session = await getBrowserSessionById(sessionId);
    if (!session) return { ok: false, status: 'error', message: 'Session not found.' };

    const portal = session.portal || session.portalKey || 'unknown';
    const meta = getPortalMeta(session.portal);
    connectorLog(portal, 'validation_request', {
      sessionId,
      verifyUrl: meta?.verifyUrl,
      loginUrl: meta?.loginUrl,
      hasEncryptedCookies: Boolean(session.encryptedCookies),
      hasEncryptedStorage: Boolean(session.encryptedStorage),
      expiresAt: session.expiresAt,
    });

    if (session.expiresAt && new Date(session.expiresAt).getTime() < Date.now()) {
      // Soft TTL: if we still have encrypted cookies/storage, attempt a live
      // browser validation instead of hard-failing. Cookie sessions often outlive
      // the stored expiresAt clock. Only mark needs_login when there is nothing
      // to validate with.
      if (!session.encryptedCookies && !session.encryptedStorage) {
        const message = 'Stored session TTL expired — mark needs_login';
        connectorLog(portal, 'validation_response', { kind: 'expired', message }, 'warn');
        await touchBrowserSession(sessionId, {
          sessionStatus: 'needs_login',
          lastValidationError: message,
        });
        return { ok: false, status: 'needs_login', message, responseKind: 'other' };
      }
      connectorLog(
        portal,
        'validation_ttl_expired_retry_live',
        { expiresAt: session.expiresAt },
        'warn',
      );
    }

    if (!meta) {
      return { ok: false, status: 'error', message: 'Unknown portal.' };
    }

    if (!session.encryptedCookies && !session.encryptedStorage) {
      await touchBrowserSession(sessionId, {
        sessionStatus: 'needs_login',
        lastValidationError: 'Login required — no encrypted storageState',
      });
      return { ok: false, status: 'needs_login', message: 'Login required.' };
    }

    // Skip live browser validation when recently verified (eliminates duplicate navs).
    if (
      !options?.force &&
      session.sessionStatus === 'valid' &&
      session.lastVerified
    ) {
      const age = Date.now() - new Date(session.lastVerified).getTime();
      if (age >= 0 && age < RESEARCH_BROWSER_CONFIG.validateFreshMs) {
        researchPerfLog('session_validation', t0, {
          portal,
          skipped: true,
          ageMs: age,
        });
        connectorLog(portal, 'validation_skipped_fresh', { ageMs: age });
        return { ok: true, status: 'valid', responseKind: '200', skippedFresh: true };
      }
    }

    const outcome = await researchBrowserManager.withPage(
      session,
      `validate-${session.portal}`,
      async (page) => {
        let httpStatus: number | null = null;
        let finalUrl = '';
        let title = '';
        let bodySnippet = '';
        try {
          // Always verify against verifyUrl — never loginUrl.
          let verifyUrl = meta.verifyUrl;
          try {
            const { getPortalConnector } = await import('@/connectors/registry');
            const connector = getPortalConnector(portal);
            if (
              connector &&
              'getVerifyUrl' in connector &&
              typeof (connector as { getVerifyUrl?: () => string }).getVerifyUrl === 'function'
            ) {
              verifyUrl = (connector as { getVerifyUrl: () => string }).getVerifyUrl();
            }
          } catch {
            /* config fallback */
          }

          const response = await this.pages.goto(page, verifyUrl);
          httpStatus = response?.status() ?? null;
          finalUrl = page.url();
          title = await page.title().catch(() => '');
          const body = (await page.content()).toLowerCase();
          bodySnippet = body.slice(0, 500);

          const kind = classifyHttpStatus(httpStatus);
          connectorLog(portal, 'validation_response', {
            httpStatus,
            kind,
            finalUrl,
            verifyUrl,
            title,
            bodySnippet,
          });

          // HTTP 401/403 is not always "logged out". MagicBricks www often returns
          // Akamai Access Denied (403) after a successful OTP while SSO cookies
          // (ACEGI / userUniqToken) are already set. Score cookies before failing.
          if (httpStatus === 401 || httpStatus === 403) {
            const {
              scoreAuthEvidence,
              hasStrongPortalSsoCookies,
            } = await import('@/lib/research/auth-detection/auth-evidence-engine');
            const cookies = await page.context().cookies().catch(() => []);
            const cookieNames = cookies.map((c) => c.name);
            const evidence = scoreAuthEvidence({
              url: finalUrl,
              title,
              bodyHtml: bodySnippet,
              cookies,
              mode: 'verify',
              verifyUrl,
              portal,
              settled: true,
              readyState: 'complete',
            });
            const sso = hasStrongPortalSsoCookies(portal, cookieNames);
            connectorLog(portal, 'validation_http_auth_wall', {
              httpStatus,
              title,
              cookieCount: cookies.length,
              sso,
              evidenceAuth: evidence.authenticated,
              cookieNames: cookieNames.slice(0, 24),
            });
            if (evidence.authenticated || sso) {
              return {
                httpStatus,
                finalUrl,
                title,
                bodySnippet,
                kind,
                authenticated: true,
                loginConfidence: evidence.confidence || 70,
                message: `SSO cookies valid despite HTTP ${httpStatus} (${title || 'auth wall'})`,
              } satisfies ValidationProbe;
            }
            return {
              httpStatus,
              finalUrl,
              title,
              bodySnippet,
              kind,
              authenticated: false,
              message: `Validation HTTP ${httpStatus} — session unauthorized`,
              loginConfidence: evidence.confidence,
            } satisfies ValidationProbe;
          }

          if (isSecurityChallenge(httpStatus, title, body)) {
            const {
              scoreAuthEvidence,
              hasStrongPortalSsoCookies,
            } = await import('@/lib/research/auth-detection/auth-evidence-engine');
            const cookies = await page.context().cookies().catch(() => []);
            const evidence = scoreAuthEvidence({
              url: finalUrl,
              title,
              bodyHtml: bodySnippet,
              cookies,
              mode: 'verify',
              verifyUrl,
              portal,
              settled: true,
              readyState: 'complete',
            });
            if (
              evidence.authenticated ||
              hasStrongPortalSsoCookies(
                portal,
                cookies.map((c) => c.name),
              )
            ) {
              return {
                httpStatus,
                finalUrl,
                title,
                bodySnippet,
                kind: kind === '406' ? '406' : kind,
                authenticated: true,
                loginConfidence: evidence.confidence || 70,
                message: `SSO cookies valid despite security challenge (${title || 'wall'})`,
              } satisfies ValidationProbe;
            }
            return {
              httpStatus,
              finalUrl,
              title,
              bodySnippet,
              kind: kind === '406' ? '406' : 'other',
              authenticated: false,
              message: `Validation blocked by portal security challenge (HTTP ${httpStatus ?? 'n/a'}: ${title || 'Security Alert'}). Use headed Chromium (RESEARCH_BROWSER_HEADLESS unset/false).`,
            } satisfies ValidationProbe;
          }

          const {
            evaluatePageAuth,
          } = await import('@/lib/research/auth-detection/auth-evidence-engine');
          const {
            writePortalAuthTrace,
          } = await import('@/lib/research/auth-detection/auth-evidence');

          // Short settle: cookies/storage are restored from the profile before nav, so
          // evidence is available at domcontentloaded. Analytics-heavy portals rarely
          // reach true networkidle — a long wait here only added ~15s per validate.
          // Defaults tightened: 3s idle + 800ms settle (override via env if needed).
          const idleMs = Number(process.env.RESEARCH_VALIDATE_NETWORKIDLE_MS || 3_000);
          const settleMs = Number(process.env.RESEARCH_VALIDATE_SETTLE_MS || 800);
          await page.waitForLoadState('networkidle', { timeout: idleMs }).catch(() => undefined);
          if (settleMs > 0) {
            await new Promise((r) => setTimeout(r, settleMs));
          }

          const evidence = await evaluatePageAuth(page, {
            portal,
            mode: 'verify',
            verifyUrl,
            settled: true,
            readyState: 'complete',
          });

          // Persist diagnostic trace (best-effort). Screenshots/HTML dumps are I/O
          // heavy, so collect only on failure or when explicitly enabled.
          const traceWanted =
            !evidence.authenticated || process.env.RESEARCH_AUTH_TRACE === '1';
          if (traceWanted) {
            try {
              const { collectPageAuthEvidence } = await import(
                '@/lib/research/auth-detection/auth-evidence'
              );
              const trace = await collectPageAuthEvidence(page, {
                portal,
                phase: 'validateSession_verifyUrl',
                httpStatus,
                loginUrl: meta.loginUrl,
                waitedExtraSettleMs: 0,
              });
              // Overlay engine result onto trace confidence for operators.
              trace.confidence = {
                cookies: evidence.breakdown.cookies,
                profile: evidence.breakdown.dom,
                logout: 0,
                storage: evidence.breakdown.storage,
                api: 0,
                navigation: 0,
                security: evidence.breakdown.security,
                other: 0,
                rawTotal: evidence.breakdown.rawTotal,
                total: evidence.confidence,
                maxPossible: evidence.breakdown.maxPossible,
                threshold: evidence.threshold,
                pass: evidence.authenticated,
                pointsLost: evidence.breakdown.pointsLost,
              };
              trace.rootCauseHypothesis = evidence.authenticated
                ? null
                : evidence.summary;
              await writePortalAuthTrace(trace);
            } catch {
              /* trace optional */
            }
          }

          const { connectorRuntime } = await import('@/connectors/common/connector-runtime');
          connectorRuntime.markSessionRestored(session.workspaceId, portal, {
            cookieCount: evidence.cookieCount,
            storageRestored: evidence.storageStatePresent,
          });
          connectorRuntime.markLogin(session.workspaceId, portal, {
            confidence: evidence.confidence,
            ok: evidence.authenticated,
          });

          if (!evidence.authenticated) {
            return {
              httpStatus,
              finalUrl,
              title,
              bodySnippet,
              kind: kind === '200' ? '200' : kind,
              authenticated: false,
              message: evidence.summary,
              loginConfidence: evidence.confidence,
            } satisfies ValidationProbe;
          }

          return {
            httpStatus,
            finalUrl,
            title,
            bodySnippet,
            kind: kind === '200' ? '200' : kind,
            authenticated: true,
            loginConfidence: evidence.confidence,
          } satisfies ValidationProbe;
        } catch (error) {
          const errMessage = error instanceof Error ? error.message : String(error);
          const kind = classifyException(errMessage);
          connectorLog(
            portal,
            'validation_exception',
            { httpStatus, finalUrl: page.url(), kind, error: errMessage },
            'error',
          );
          if (isBrowserLifecycleError(errMessage)) {
            throw error instanceof Error ? error : new Error(errMessage);
          }
          return {
            httpStatus,
            finalUrl: page.url(),
            title,
            bodySnippet,
            kind,
            authenticated: false,
            message: `Validation ${kind}: ${errMessage}`,
          } satisfies ValidationProbe;
        }
      },
    );

    if (outcome.error) {
      const message = outcome.error.message;
      const kind = classifyException(message);
      const needsLogin = kind === 'timeout' ? false : /unauthorized|login|auth/i.test(message);
      const status: ResearchBrowserSessionStatus = needsLogin ? 'needs_login' : 'error';
      connectorLog(portal, 'validation_exception', { kind, error: message }, 'error');
      await touchBrowserSession(sessionId, {
        sessionStatus: status,
        lastValidationError: message,
      });
      return { ok: false, status, message, responseKind: kind };
    }

    const probe = outcome.result!;
    if (!probe.authenticated) {
      // 401/403 + login/OTP surfaces → needs_login. Bot walls / other HTTP → error with exact message.
      const finalStatus: ResearchBrowserSessionStatus =
        probe.kind === '401' ||
        probe.kind === '403' ||
        /login expired|unauthorized|otp/i.test(probe.message || '')
          ? 'needs_login'
          : 'error';

      await touchBrowserSession(sessionId, {
        sessionStatus: finalStatus,
        lastValidationError: probe.message || `Validation failed (${probe.kind})`,
      });
      connectorLog(
        portal,
        'validation_failed',
        {
          httpStatus: probe.httpStatus,
          kind: probe.kind,
          status: finalStatus,
          message: probe.message,
        },
        'warn',
      );
      return {
        ok: false,
        status: finalStatus,
        message: probe.message || `Validation failed (${probe.kind})`,
        httpStatus: probe.httpStatus,
        responseKind: probe.kind,
        loginConfidence: probe.loginConfidence,
      };
    }

    await touchBrowserSession(sessionId, {
      sessionStatus: 'valid',
      lastVerified: new Date().toISOString(),
      lastValidationError: '',
      expiresAt: new Date(Date.now() + RESEARCH_BROWSER_CONFIG.sessionTtlMs).toISOString(),
    });
    researchPerfLog('session_validation', t0, {
      portal,
      skipped: false,
      httpStatus: probe.httpStatus,
    });
    connectorLog(portal, 'validation_ok', {
      httpStatus: probe.httpStatus,
      kind: probe.kind,
      finalUrl: probe.finalUrl,
      loginConfidence: probe.loginConfidence,
    });
    return {
      ok: true,
      status: 'valid',
      httpStatus: probe.httpStatus,
      responseKind: probe.kind,
      loginConfidence: probe.loginConfidence,
    };
  }

  async refreshFromLiveBrowser(sessionId: string): Promise<ResearchBrowserSession> {
    return this.renew(sessionId);
  }

  async saveAuthenticatedState(input: {
    workspaceId: string;
    portal: string;
  }): Promise<ResearchBrowserSession> {
    const session = await this.getOrCreate(input.workspaceId, input.portal);
    return this.renew(session.id);
  }
}

export const browserSessionManager = new BrowserSessionManager();
