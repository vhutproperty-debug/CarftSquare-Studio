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
import { looksAuthenticated } from '@/lib/research/browser-gateway/login-detect';
import { notifySessionNeedsLogin } from '@/lib/research/browser-gateway/gateway';
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

  let handle: Awaited<ReturnType<typeof adapter.launchLoginSession>> | null = null;

  try {
    await updateConnectSession(session.id, {
      phase: 'opening_browser',
      message: 'Opening Browser…',
      workerId: WORKER_ID,
    });
    pushWorkerLog('info', `Opening Chromium for ${session.portal} (${session.provider})`);

    handle = await adapter.launchLoginSession({
      workspaceId: session.workspaceId,
      portal: session.portal,
      loginUrl: session.loginUrl,
      profileDir,
    });

    await updateConnectSession(session.id, {
      phase: 'waiting_for_login',
      message: 'Waiting for Login…',
      browserVersion: handle.browserVersion,
      liveViewUrl: handle.liveViewUrl,
      previewPath: path.relative(process.cwd(), previewFile).replace(/\\/g, '/'),
    });
    pushWorkerLog('info', `Chromium ready — waiting for login on ${session.loginUrl}`);

    await handle.gotoLogin(session.loginUrl);

    const deadline = Date.now() + LOGIN_TIMEOUT_MS;
    let authenticated = false;
    while (Date.now() < deadline) {
      const current = await getConnectSessionById(session.id);
      if (!current || current.phase === 'cancelled' || current.phase === 'expired') {
        await handle.close();
        return true;
      }

      if (handle.writePreview) {
        await handle.writePreview(previewFile).catch(() => undefined);
        await updateConnectSession(session.id, {
          previewUpdatedAt: new Date().toISOString(),
          previewPath: path.relative(process.cwd(), previewFile).replace(/\\/g, '/'),
        });
      }

      const signals = await handle.pageSignals();
      if (looksAuthenticated(signals)) {
        authenticated = true;
        break;
      }
      await sleep(2000);
    }

    if (!authenticated) {
      await updateConnectSession(session.id, {
        phase: 'failed',
        errorMessage: 'Login timed out before authentication was detected',
        finishedAt: new Date().toISOString(),
      });
      pushWorkerLog('error', `Login timed out for ${session.portal}`);
      setWorkerError(`Login timed out for ${session.portal}`);
      await handle.close();
      markWorkerJobDone();
      return true;
    }

    pushWorkerLog('info', `Login detected for ${session.portal} — capturing session`);
    await updateConnectSession(session.id, {
      phase: 'capturing',
      message: 'Capturing Session…',
    });
    const secrets = await handle.captureSecrets();
    const cookieCount = secrets.cookieCount ?? 0;
    pushWorkerLog('info', `cookie_capture cookieCount=${cookieCount}`);

    await updateConnectSession(session.id, {
      phase: 'encrypting',
      message: 'Encrypting…',
    });
    pushWorkerLog('info', `encryption cookieCount=${cookieCount}`);

    // Close live browser before validation so the persistent profile is not locked.
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
    pushWorkerLog('info', `validation_request portal=${session.portal}`);

    const connector = requirePortalConnector(session.portal);
    const validation = await connector.validateSession(session.workspaceId);

    if (!validation.ok) {
      const detail =
        validation.message ||
        `Validation failed after login (status=${validation.status})`;
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
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await updateConnectSession(session.id, {
      phase: 'failed',
      errorMessage: message,
      finishedAt: new Date().toISOString(),
    });
    pushWorkerLog('error', message);
    setWorkerError(message);
    if (handle) await handle.close().catch(() => undefined);
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
