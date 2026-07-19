import fs from 'fs/promises';
import path from 'path';
import { hostname } from 'os';
import { requirePortalConnector } from '@/connectors/registry';
import { RESEARCH_BROWSER_CONFIG } from '@/lib/research/browser/config';
import { researchBrowserManager } from '@/lib/research/browser/browser-manager';
import { getBrowserProviderAdapter } from '@/lib/research/browser-gateway/adapters';
import {
  claimNextConnectSession,
  expireStaleConnectSessions,
  getConnectSessionById,
  updateConnectSession,
} from '@/lib/research/browser-gateway/connect-session-store';
import {
  looksAuthenticated,
  observeLoginSignals,
  type LoginDetectState,
} from '@/lib/research/browser-gateway/login-detect';
import { notifySessionNeedsLogin } from '@/lib/research/browser-gateway/gateway';
import type { BrowserLaunchHandle, ConnectSession } from '@/lib/research/browser-gateway/types';
import {
  markWorkerJobDone,
  pushWorkerLog,
  setWorkerActiveJob,
  setWorkerError,
} from '@/lib/research/browser-gateway/worker-state';
import { RESEARCH_COLLECTIONS } from '@/lib/research/collections';
import { recordWorkerHeartbeat } from '@/lib/research/monitoring/worker-health';
import { browserSessionManager } from '@/lib/research/sessions/browser-session-manager';
import {
  findBrowserSession,
  upsertBrowserSession,
} from '@/lib/research/sessions/session-store';
import { ensureResearchIndexes, getResearchDatabase } from '@/lib/research/store';
import { upsertPortalConnection } from '@/lib/research/store/portal-connections';

const WORKER_ID = `browser-${hostname()}-${process.pid}`;
const LOGIN_TIMEOUT_MS = Number(process.env.RESEARCH_CONNECT_TIMEOUT_MS || 12 * 60 * 1000);
const VALIDATE_EVERY_MS = Number(process.env.RESEARCH_SESSION_VALIDATE_MS || 3 * 60 * 60 * 1000);
const MAX_VALIDATION_RETRIES = Number(process.env.RESEARCH_CONNECT_VALIDATION_RETRIES || 2);

/**
 * Process one queued remote-connect (or validate-only) job.
 * Must run outside Next.js.
 */
export async function processNextConnectJob(): Promise<boolean> {
  await expireStaleConnectSessions();
  await recordWorkerHeartbeat({
    workerId: WORKER_ID,
    workerType: 'browser_crawl',
    status: 'busy',
  });

  const session = await claimNextConnectSession(WORKER_ID);
  if (!session) {
    await recordWorkerHeartbeat({
      workerId: WORKER_ID,
      workerType: 'browser_crawl',
      status: 'idle',
    });
    setWorkerActiveJob(null, null);
    return false;
  }

  setWorkerActiveJob(session.id, session.portal);
  pushWorkerLog('info', `Claimed connect session ${session.id} for ${session.portal}`);
  await updateConnectSession(session.id, {
    phase: 'connecting',
    message: 'Worker Connected — preparing browser…',
    workerId: WORKER_ID,
  });

  const db = await getResearchDatabase();
  await ensureResearchIndexes(db);
  const raw = await db.collection(RESEARCH_COLLECTIONS.connectSessions).findOne({ id: session.id });
  const validateOnly = Boolean(raw && (raw as { validateOnly?: boolean }).validateOnly);

  if (validateOnly) {
    await runValidateOnly(session.workspaceId, session.portal, session.id);
    markWorkerJobDone();
    return true;
  }

  const adapter = getBrowserProviderAdapter(session.provider);
  const profileDir = researchBrowserManager.profilePath(session.workspaceId, session.portal);
  const previewDir = path.join(
    RESEARCH_BROWSER_CONFIG.screenshotRoot,
    'connect',
    session.id,
  );
  const previewFile = path.join(previewDir, 'live.jpg');

  let handle: BrowserLaunchHandle | null = null;
  let validationAttempt = 0;

  try {
    // Outer loop: wait for login → capture → validate. On recoverable validation
    // failures (e.g. HTTP 406), reopen the browser and let the user log in again.
    while (true) {
      const stopped = await ensureCancelled(session.id, handle);
      if (stopped) return true;

      await updateConnectSession(session.id, {
        phase: 'opening_browser',
        message: 'Opening Secure Browser…',
        workerId: WORKER_ID,
      });
      const connectHeadless = process.env.RESEARCH_CONNECT_HEADLESS === 'true';
      pushWorkerLog(
        'info',
        `Opening Chromium for ${session.portal} (${session.provider}) headless=${connectHeadless} RESEARCH_BROWSER_HEADLESS=${process.env.RESEARCH_BROWSER_HEADLESS || 'unset'}`,
      );

      handle = await adapter.launchLoginSession({
        workspaceId: session.workspaceId,
        portal: session.portal,
        loginUrl: session.loginUrl,
        profileDir,
        connectSessionId: session.id,
      });

      await updateConnectSession(session.id, {
        phase: 'waiting_for_login',
        message: handle.liveViewUrl
          ? validationAttempt > 0
            ? 'Browser Ready — reopen the secure login window and sign in again.'
            : 'Browser Ready — open the secure login window to continue.'
          : validationAttempt > 0
            ? 'Validation failed — please log in again…'
            : 'Waiting for Login…',
        browserVersion: handle.browserVersion,
        liveViewUrl: handle.liveViewUrl,
        previewPath: path.relative(process.cwd(), previewFile).replace(/\\/g, '/'),
      });
      pushWorkerLog(
        'info',
        `login_wait_start portal=${session.portal} url=${session.loginUrl} liveView=${
          handle.liveViewUrl ? 'yes' : 'no'
        }`,
      );

      await handle.gotoLogin(session.loginUrl);

      const authenticated = await waitForManualLogin({
        session,
        handle,
        previewFile,
      });

      if (!authenticated) {
        // waitForManualLogin already closed + marked failed/cancelled
        handle = null;
        markWorkerJobDone();
        return true;
      }

      pushWorkerLog('info', `login_detected portal=${session.portal} — capturing session`);
      await updateConnectSession(session.id, {
        phase: 'capturing',
        message: 'Authenticating — capturing session…',
      });
      const secrets = await handle.captureSecrets();
      const cookieCount = secrets.cookieCount ?? 0;
      pushWorkerLog('info', `cookie_capture portal=${session.portal} cookieCount=${cookieCount}`);

      await updateConnectSession(session.id, {
        phase: 'encrypting',
        message: 'Encrypting…',
      });
      pushWorkerLog('info', `encryption portal=${session.portal} cookieCount=${cookieCount}`);

      // Close live browser before validation so the persistent profile is not locked.
      pushWorkerLog('info', `browser_close_before_validation portal=${session.portal}`);
      await handle.close();
      handle = null;

      const browserSession = await upsertBrowserSession({
        workspaceId: session.workspaceId,
        portal: session.portal,
        browserProfile: profileDir,
        encryptedCookies: secrets.encryptedCookies,
        encryptedStorage: secrets.encryptedStorage,
        sessionStatus: 'valid',
        lastVerified: new Date().toISOString(),
      });

      await updateConnectSession(session.id, {
        phase: 'validating',
        message: 'Validating…',
        browserSessionId: browserSession.id,
      });
      pushWorkerLog(
        'info',
        `validation_start portal=${session.portal} attempt=${validationAttempt + 1} sessionId=${browserSession.id}`,
      );

      const connector = requirePortalConnector(session.portal);
      const validation = await connector.validateSession(session.workspaceId);
      const validationHttp =
        'httpStatus' in validation ? (validation as { httpStatus?: number | null }).httpStatus : undefined;
      pushWorkerLog(
        validation.ok ? 'info' : 'warn',
        `validation_result portal=${session.portal} ok=${validation.ok} status=${validation.status} httpStatus=${
          validationHttp ?? 'n/a'
        } message=${validation.message || ''}`,
      );

      if (validation.ok) {
        await upsertPortalConnection({
          workspaceId: session.workspaceId,
          portalKey: session.portal,
          portalName: session.portalName,
          status: 'connected',
          lastError: null,
        });

        await updateConnectSession(session.id, {
          phase: 'connected',
          message: 'Connected',
          finishedAt: new Date().toISOString(),
          browserSessionId: browserSession.id,
        });
        pushWorkerLog('info', `${session.portal} Connected`);
        setWorkerError(null);
        markWorkerJobDone();
        return true;
      }

      const detail =
        validation.message ||
        `Validation failed after login (status=${validation.status})`;
      const recoverable = isRecoverableValidationFailure(detail, validation);

      if (!recoverable || validationAttempt + 1 >= MAX_VALIDATION_RETRIES) {
        await updateConnectSession(session.id, {
          phase: 'failed',
          errorMessage: detail,
          finishedAt: new Date().toISOString(),
        });
        pushWorkerLog('error', detail);
        setWorkerError(detail);
        markWorkerJobDone();
        return true;
      }

      // Keep connect session alive — reopen headed browser for another manual login.
      validationAttempt += 1;
      pushWorkerLog(
        'warn',
        `validation_retry portal=${session.portal} attempt=${validationAttempt}/${MAX_VALIDATION_RETRIES} reason=${detail}`,
      );
      await updateConnectSession(session.id, {
        phase: 'waiting_for_login',
        message:
          'Validation was blocked (portal security). Browser reopening — please log in again.',
        errorMessage: detail,
        finishedAt: undefined,
      });
      setWorkerError(detail);
      // loop continues → reopen browser
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await updateConnectSession(session.id, {
      phase: 'failed',
      errorMessage: message,
      finishedAt: new Date().toISOString(),
    });
    pushWorkerLog('error', message);
    setWorkerError(message);
    if (handle) {
      pushWorkerLog('info', `browser_close_on_error portal=${session.portal}`);
      await handle.close().catch(() => undefined);
    }
    markWorkerJobDone();
    return true;
  } finally {
    await recordWorkerHeartbeat({
      workerId: WORKER_ID,
      workerType: 'browser_crawl',
      status: 'idle',
      workspaceId: session.workspaceId,
    });
  }
}

async function waitForManualLogin(input: {
  session: ConnectSession;
  handle: BrowserLaunchHandle;
  previewFile: string;
}): Promise<boolean> {
  const { session, handle, previewFile } = input;
  const deadline = Date.now() + LOGIN_TIMEOUT_MS;
  let poll = 0;
  let detectState: LoginDetectState = { sawLoginSurface: false };

  while (Date.now() < deadline) {
    const current = await getConnectSessionById(session.id);
    if (!current || current.phase === 'cancelled' || current.phase === 'expired') {
      pushWorkerLog(
        'info',
        `login_wait_aborted portal=${session.portal} phase=${current?.phase || 'missing'}`,
      );
      pushWorkerLog('info', `browser_close portal=${session.portal} reason=cancelled_or_expired`);
      await handle.close();
      return false;
    }

    if (handle.writePreview) {
      await handle.writePreview(previewFile).catch(() => undefined);
      await updateConnectSession(session.id, {
        previewUpdatedAt: new Date().toISOString(),
        previewPath: path.relative(process.cwd(), previewFile).replace(/\\/g, '/'),
      });
    }

    const signals = await handle.pageSignals();
    detectState = observeLoginSignals(
      { ...signals, loginUrl: session.loginUrl },
      detectState,
    );
    const authenticated = looksAuthenticated(
      { ...signals, loginUrl: session.loginUrl },
      detectState,
    );

    if (poll % 5 === 0) {
      pushWorkerLog(
        'info',
        `login_wait_poll portal=${session.portal} n=${poll} url=${signals.url} cookies=${
          signals.cookieCount ?? 'n/a'
        } sawLoginSurface=${detectState.sawLoginSurface} authenticated=${authenticated}`,
      );
    }

    if (authenticated) {
      pushWorkerLog(
        'info',
        `login_wait_success portal=${session.portal} url=${signals.url} cookies=${
          signals.cookieCount ?? 'n/a'
        } sawLoginSurface=${detectState.sawLoginSurface}`,
      );
      return true;
    }

    poll += 1;
    await sleep(2000);
  }

  await updateConnectSession(session.id, {
    phase: 'failed',
    errorMessage: 'Login timed out before authentication was detected',
    finishedAt: new Date().toISOString(),
  });
  pushWorkerLog('error', `Login timed out for ${session.portal}`);
  setWorkerError(`Login timed out for ${session.portal}`);
  pushWorkerLog('info', `browser_close portal=${session.portal} reason=login_timeout`);
  await handle.close();
  return false;
}

function isRecoverableValidationFailure(
  detail: string,
  validation: { status?: string; httpStatus?: number | null; responseKind?: string; message?: string },
): boolean {
  const text = detail.toLowerCase();
  const httpStatus =
    typeof validation.httpStatus === 'number'
      ? validation.httpStatus
      : undefined;
  if (httpStatus === 406) return true;
  if (validation.responseKind === '406') return true;
  if (text.includes('security challenge') || text.includes('security alert')) return true;
  if (text.includes('406')) return true;
  if (validation.status === 'needs_login') return true;
  return false;
}

async function ensureCancelled(
  sessionId: string,
  handle: BrowserLaunchHandle | null,
): Promise<boolean> {
  const current = await getConnectSessionById(sessionId);
  if (!current || current.phase === 'cancelled' || current.phase === 'expired') {
    if (handle) await handle.close().catch(() => undefined);
    return true;
  }
  return false;
}

async function runValidateOnly(workspaceId: string, portal: string, connectId: string) {
  try {
    await updateConnectSession(connectId, {
      phase: 'validating',
      message: 'Re-validating encrypted session…',
      workerId: WORKER_ID,
    });
    const session = await findBrowserSession(workspaceId, portal);
    if (!session?.encryptedCookies) {
      await notifySessionNeedsLogin({ workspaceId, portal });
      await updateConnectSession(connectId, {
        phase: 'failed',
        errorMessage: 'No encrypted session to validate',
        finishedAt: new Date().toISOString(),
      });
      return;
    }
    const result = await browserSessionManager.validateSession(session.id, { force: true });
    if (!result.ok) {
      await notifySessionNeedsLogin({ workspaceId, portal });
      await updateConnectSession(connectId, {
        phase: 'failed',
        errorMessage: result.message || 'Session invalid',
        finishedAt: new Date().toISOString(),
      });
      return;
    }
    await upsertPortalConnection({
      workspaceId,
      portalKey: portal,
      portalName: portal,
      status: 'connected',
    });
    await updateConnectSession(connectId, {
      phase: 'connected',
      message: 'Session still valid',
      finishedAt: new Date().toISOString(),
      browserSessionId: session.id,
    });
  } catch (error) {
    await updateConnectSession(connectId, {
      phase: 'failed',
      errorMessage: error instanceof Error ? error.message : String(error),
      finishedAt: new Date().toISOString(),
    });
  }
}

/** Periodically validate all portal sessions for a workspace. */
export async function validateDueSessions(workspaceId?: string): Promise<number> {
  const db = await getResearchDatabase();
  await ensureResearchIndexes(db);
  const filter: Record<string, unknown> = {
    sessionStatus: 'valid',
    encryptedCookies: { $exists: true },
  };
  if (workspaceId) filter.workspaceId = workspaceId;

  const sessions = await db
    .collection(RESEARCH_COLLECTIONS.browserSessions)
    .find(filter)
    .limit(50)
    .toArray();

  let checked = 0;
  const now = Date.now();
  for (const s of sessions) {
    const last = s.lastVerified ? new Date(s.lastVerified).getTime() : 0;
    if (now - last < VALIDATE_EVERY_MS) continue;
    const result = await browserSessionManager.validateSession(s.id, { force: true });
    checked += 1;
    if (!result.ok) {
      await notifySessionNeedsLogin({
        workspaceId: s.workspaceId,
        portal: s.portal || s.portalKey,
      });
    }
  }
  return checked;
}

export async function cleanupExpiredProfiles(): Promise<number> {
  // Remove stale connect preview frames (profiles wiped on disconnect).
  const root = path.join(RESEARCH_BROWSER_CONFIG.screenshotRoot, 'connect');
  try {
    const dirs = await fs.readdir(root);
    let removed = 0;
    for (const dir of dirs) {
      const full = path.join(root, dir);
      const stat = await fs.stat(full).catch(() => null);
      if (!stat?.isDirectory()) continue;
      if (Date.now() - stat.mtimeMs > 24 * 60 * 60 * 1000) {
        await fs.rm(full, { recursive: true, force: true });
        removed += 1;
      }
    }
    return removed;
  } catch {
    return 0;
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
