import fs from 'fs/promises';
import path from 'path';
import { hostname } from 'os';
import { RESEARCH_BROWSER_CONFIG, getPortalMeta } from '@/lib/research/browser/config';
import { acquireProfileLock } from '@/lib/research/browser/profile-lock';
import {
  prepareConnectProfileDir,
  removeConnectProfileDir,
} from '@/lib/research/browser/runtime-paths';
import { getBrowserProviderAdapter } from '@/lib/research/browser-gateway/adapters';
import {
  CONNECT_USER_MESSAGES,
  friendlyConnectError,
} from '@/lib/research/browser-gateway/connect-messages';
import { transitionConnectSession } from '@/lib/research/browser-gateway/connect-phase-machine';
import {
  claimNextConnectSession,
  expireStaleConnectSessions,
  getConnectSessionById,
  updateConnectSession,
} from '@/lib/research/browser-gateway/connect-session-store';
import {
  observeLoginSignals,
  scoreAuthentication,
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
  pushWorkerLog(
    'info',
    `connect_claimed sessionId=${session.id} portal=${session.portal} workerId=${WORKER_ID} pid=${process.pid}`,
  );
  // claimNextConnectSession already set phase=connecting; log + message only.
  pushWorkerLog(
    'info',
    `connect_pipeline Queued → Connecting sessionId=${session.id} caller=processNextConnectJob.claim`,
  );
  await updateConnectSession(session.id, {
    message: CONNECT_USER_MESSAGES.preparing,
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
  const previewDir = path.join(
    RESEARCH_BROWSER_CONFIG.screenshotRoot,
    'connect',
    session.id,
  );
  const previewFile = path.join(previewDir, 'live.jpg');
  await fs.mkdir(previewDir, { recursive: true }).catch(() => undefined);

  let handle: BrowserLaunchHandle | null = null;
  let profileDir = '';
  let profileLock: { release: () => Promise<void> } | null = null;

  try {
    // Exclusive lock: one browser per Connect session across workers/processes.
    profileLock = await acquireProfileLock(`connect:${session.id}`);

    // Login → same-context verify → capture storageState → persist valid → close.
    // Single-pass loop (kept as while for cancel checks at top); hard-capped against runaway.
    let connectPasses = 0;
    while (connectPasses < 2) {
      connectPasses += 1;
      const stopped = await ensureCancelled(session.id, handle);
      if (stopped) {
        pushWorkerLog(
          'info',
          `connect_done sessionId=${session.id} reason=cancelled_or_expired`,
        );
        return true;
      }

      await transitionConnectSession({
        sessionId: session.id,
        to: 'opening_browser',
        message: CONNECT_USER_MESSAGES.opening,
        workerId: WORKER_ID,
        caller: 'processNextConnectJob.opening_browser',
      });

      try {
        profileDir = await prepareConnectProfileDir(session.id, session.portal);
      } catch (error) {
        const friendly = friendlyConnectError(error);
        pushWorkerLog(
          'warn',
          `profile_dir_unavailable sessionId=${session.id} error=${
            error instanceof Error ? error.message : String(error)
          } — ${friendly}`,
        );
        await updateConnectSession(session.id, {
          message: CONNECT_USER_MESSAGES.profileUnavailable,
        });
        profileDir = await prepareConnectProfileDir(session.id, session.portal);
      }

      pushWorkerLog(
        'info',
        `connect_profile sessionId=${session.id} portal=${session.portal} profileDir=${profileDir} workerPid=${process.pid}`,
      );
      await updateConnectSession(session.id, {
        message: CONNECT_USER_MESSAGES.profileReady,
      });

      const connectHeadless = process.env.RESEARCH_CONNECT_HEADLESS === 'true';
      pushWorkerLog(
        'info',
        `browser_launch_start sessionId=${session.id} portal=${session.portal} provider=${session.provider} headless=${connectHeadless} profileDir=${profileDir}`,
      );

      try {
        handle = await adapter.launchLoginSession({
          workspaceId: session.workspaceId,
          portal: session.portal,
          loginUrl: session.loginUrl,
          profileDir,
          connectSessionId: session.id,
        });
      } catch (error) {
        pushWorkerLog(
          'warn',
          `browser_launch_failed sessionId=${session.id} — ${friendlyConnectError(error)} raw=${
            error instanceof Error ? error.message : String(error)
          }`,
        );
        await updateConnectSession(session.id, {
          message: CONNECT_USER_MESSAGES.browserRetry,
        });
        // One immediate retry with a brand-new profile directory.
        await removeConnectProfileDir(profileDir);
        profileDir = await prepareConnectProfileDir(`${session.id}-retry`, session.portal);
        handle = await adapter.launchLoginSession({
          workspaceId: session.workspaceId,
          portal: session.portal,
          loginUrl: session.loginUrl,
          profileDir,
          connectSessionId: session.id,
        });
      }

      const previewRel = path
        .relative(RESEARCH_BROWSER_CONFIG.screenshotRoot, previewFile)
        .replace(/\\/g, '/');

      // Navigate BEFORE publishing liveViewUrl so noVNC never shows about:blank.
      // Housing / MagicBricks / 99acres all need the login surface visible when the
      // operator opens the remote window (evidence: blank desktop while goto pending).
      pushWorkerLog(
        'info',
        `login_nav_before_liveview sessionId=${session.id} portal=${session.portal} url=${session.loginUrl}`,
      );
      await handle.gotoLogin(session.loginUrl);

      await transitionConnectSession({
        sessionId: session.id,
        to: 'waiting_for_login',
        message: handle.liveViewUrl
          ? CONNECT_USER_MESSAGES.browserReady
          : CONNECT_USER_MESSAGES.waitingLogin,
        browserVersion: handle.browserVersion,
        liveViewUrl: handle.liveViewUrl,
        previewPath: previewRel,
        caller: 'processNextConnectJob.waiting_for_login',
      });
      pushWorkerLog(
        'info',
        `login_wait_start sessionId=${session.id} portal=${session.portal} url=${session.loginUrl} liveView=${
          handle.liveViewUrl ? 'yes' : 'no'
        } profileDir=${profileDir} browserVersion=${handle.browserVersion || 'n/a'} finalUrl=${await handle.currentUrl()}`,
      );

      const authenticated = await waitForManualLogin({
        session,
        handle,
        previewFile,
        profileDir,
      });

      if (!authenticated) {
        handle = null;
        pushWorkerLog(
          'error',
          `connect_failed sessionId=${session.id} reason=login_not_detected profileDir=${profileDir}`,
        );
        markWorkerJobDone();
        return true;
      }

      pushWorkerLog(
        'info',
        `connect_pipeline Authentication Detected sessionId=${session.id} portal=${session.portal}`,
      );

      // Same-context verify on verifyUrl BEFORE capture/persist.
      const verifyUrl =
        session.verifyUrl || getPortalMeta(session.portal)?.verifyUrl || session.loginUrl;
      pushWorkerLog(
        'info',
        `connect_pipeline SameContextVerify start sessionId=${session.id} portal=${session.portal} verifyUrl=${verifyUrl}`,
      );
      await transitionConnectSession({
        sessionId: session.id,
        to: 'verifying',
        message: CONNECT_USER_MESSAGES.validating,
        caller: 'processNextConnectJob.same_context_verify',
      });

      const gotoVerify = handle.gotoVerify || handle.gotoLogin;
      await gotoVerify.call(handle, verifyUrl);
      await new Promise((r) => setTimeout(r, 4_000));
      const verifySignals = await handle.pageSignals({
        settle: true,
        settleTimeoutMs: 20_000,
        log: (line) => pushWorkerLog('info', line),
      });
      const verifyScore = scoreAuthentication({
        ...verifySignals,
        settled: true,
        readyState: 'complete',
      });
      for (const line of verifyScore.summary.split('\n')) {
        pushWorkerLog('info', `same_context_verify ${line}`);
      }

      if (!verifyScore.authenticated) {
        pushWorkerLog(
          'error',
          `connect_failed sessionId=${session.id} reason=same_context_verify_failed confidence=${verifyScore.score}/${verifyScore.threshold}`,
        );
        await transitionConnectSession({
          sessionId: session.id,
          to: 'failed',
          errorMessage: friendlyConnectError(verifyScore.summary),
          message: friendlyConnectError(verifyScore.summary),
          finishedAt: new Date().toISOString(),
          caller: 'processNextConnectJob.same_context_verify_failed',
        });
        pushWorkerLog(
          'info',
          `browser_close_trigger sessionId=${session.id} reason=same_context_verify_failed`,
        );
        await handle.close().catch(() => undefined);
        handle = null;
        markWorkerJobDone();
        return true;
      }

      pushWorkerLog(
        'info',
        `connect_pipeline SameContextVerify PASS sessionId=${session.id} confidence=${verifyScore.score}/${verifyScore.threshold}`,
      );

      await transitionConnectSession({
        sessionId: session.id,
        to: 'capturing',
        message: CONNECT_USER_MESSAGES.capturing,
        caller: 'processNextConnectJob.capturing',
      });
      const secrets = await handle.captureSecrets();
      const cookieCount = secrets.cookieCount ?? 0;
      pushWorkerLog(
        'info',
        `connect_pipeline storageState Captured sessionId=${session.id} portal=${session.portal} cookieCount=${cookieCount} encryptedCookiesBytes=${secrets.encryptedCookies?.length ?? 0} encryptedStorageBytes=${secrets.encryptedStorage?.length ?? 0}`,
      );

      await transitionConnectSession({
        sessionId: session.id,
        to: 'encrypting',
        message: CONNECT_USER_MESSAGES.encrypting,
        cookieCount,
        caller: 'processNextConnectJob.encrypting',
      });

      const browserSession = await upsertBrowserSession({
        workspaceId: session.workspaceId,
        portal: session.portal,
        browserProfile: `encrypted:${session.portal}`,
        encryptedCookies: secrets.encryptedCookies,
        encryptedStorage: secrets.encryptedStorage,
        sessionStatus: 'valid',
        lastVerified: new Date().toISOString(),
        lastValidationError: '',
      });
      pushWorkerLog(
        'info',
        `connect_pipeline PersistOK sessionId=${session.id} browserSessionId=${browserSession.id} sessionStatus=valid`,
      );

      await upsertPortalConnection({
        workspaceId: session.workspaceId,
        portalKey: session.portal,
        portalName: session.portalName,
        status: 'connected',
        lastError: null,
      });

      await transitionConnectSession({
        sessionId: session.id,
        to: 'connected',
        message: CONNECT_USER_MESSAGES.connected,
        finishedAt: new Date().toISOString(),
        browserSessionId: browserSession.id,
        cookieCount,
        validationOk: true,
        caller: 'processNextConnectJob.same_context_connected',
      });
      pushWorkerLog(
        'info',
        `connect_pipeline Connected (Research Ready) sessionId=${session.id} portal=${session.portal} cookieCount=${cookieCount} browserSessionId=${browserSession.id}`,
      );

      pushWorkerLog(
        'info',
        `browser_close_trigger sessionId=${session.id} reason=persist_complete_normal_shutdown`,
      );
      await handle.close();
      handle = null;
      await removeConnectProfileDir(profileDir);
      profileDir = '';

      setWorkerError(null);
      markWorkerJobDone();
      return true;
    }

    pushWorkerLog(
      'error',
      `connect_failed sessionId=${session.id} reason=connect_loop_exhausted passes=${connectPasses}`,
    );
    await transitionConnectSession({
      sessionId: session.id,
      to: 'failed',
      errorMessage: 'Connect loop exhausted',
      message: 'Connect loop exhausted',
      finishedAt: new Date().toISOString(),
      caller: 'processNextConnectJob.loop_exhausted',
    }).catch(() => undefined);
    markWorkerJobDone();
    return true;
  } catch (error) {
    const friendly = friendlyConnectError(error);
    const raw = error instanceof Error ? error.message : String(error);
    await transitionConnectSession({
      sessionId: session.id,
      to: 'failed',
      errorMessage: friendly,
      message: friendly,
      finishedAt: new Date().toISOString(),
      caller: 'processNextConnectJob.catch',
    }).catch(async () => {
      await updateConnectSession(session.id, {
        phase: 'failed',
        errorMessage: friendly,
        message: friendly,
        finishedAt: new Date().toISOString(),
      });
    });
    pushWorkerLog(
      'error',
      `connect_failed sessionId=${session.id} reason=exception friendly=${friendly} raw=${raw}`,
    );
    setWorkerError(friendly);
    if (handle) {
      pushWorkerLog(
        'info',
        `browser_close_trigger sessionId=${session.id} reason=exception_cleanup raw=${raw.slice(0, 200)}`,
      );
      await handle.close().catch(() => undefined);
    }
    markWorkerJobDone();
    return true;
  } finally {
    if (profileDir) {
      await removeConnectProfileDir(profileDir);
      pushWorkerLog(
        'info',
        `connect_cleanup sessionId=${session.id} profileDir=${profileDir} removed=true`,
      );
    }
    if (profileLock) {
      await profileLock.release().catch(() => undefined);
    }
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
  profileDir: string;
}): Promise<boolean> {
  const { session, handle, previewFile, profileDir } = input;
  const deadline = Date.now() + LOGIN_TIMEOUT_MS;
  let poll = 0;
  let detectState: LoginDetectState = { sawLoginSurface: false };
  const artifactDir = path.join(path.dirname(previewFile), 'auth-probe');

  await updateConnectSession(session.id, {
    message: CONNECT_USER_MESSAGES.waitingLogin,
  });

  const evaluateOnce = async (label: string) => {
    const signals = await handle.pageSignals({
      settle: true,
      settleTimeoutMs: 20_000,
      artifactDir,
      pollIndex: poll,
      log: (line) => pushWorkerLog('info', line),
    });
    const merged = {
      ...signals,
      cookieNames: signals.cookieNames,
      localStorageKeys: signals.localStorageKeys,
      sessionStorageKeys: signals.sessionStorageKeys,
    };
    detectState = observeLoginSignals(merged, detectState);
    const result = scoreAuthentication(merged, detectState);
    const remainingMs = Math.max(0, deadline - Date.now());
    pushWorkerLog(
      'info',
      [
        `login_wait_poll sessionId=${session.id} portal=${session.portal} label=${label} n=${poll}`,
        `profileDir=${profileDir}`,
        `workerPid=${process.pid}`,
        `url=${signals.url}`,
        `title=${JSON.stringify(signals.title ?? '')}`,
        `readyState=${signals.readyState ?? 'n/a'}`,
        `settled=${signals.settled}`,
        `networkIdleMs=${signals.networkIdleMs ?? 'n/a'}`,
        `iframes=${signals.iframeCount ?? 'n/a'}`,
        `shadowHosts=${signals.shadowHostCount ?? 'n/a'}`,
        `cookies=${signals.cookieCount ?? 'n/a'}`,
        `loginSurface=${detectState.sawLoginSurface || signals.hasLoginForm === true}`,
        `avatar=${Boolean(signals.hasAvatar)}`,
        `accountName=${Boolean(signals.hasAccountName)}`,
        `editProfile=${Boolean(signals.hasEditProfile)}`,
        `logout=${Boolean(signals.hasLogout)}`,
        `profileLink=${Boolean(signals.hasProfileLink)}`,
        `loginForm=${Boolean(signals.hasLoginForm)}`,
        `profileSelectors=${(signals.profileSelectors || []).join('|') || 'none'}`,
        `html=${signals.htmlSnapshotPath ?? 'n/a'}`,
        `screenshot=${signals.screenshotPath ?? 'n/a'}`,
        `authScore=${result.score}/${result.threshold}`,
        `remainingMs=${remainingMs}`,
        `decision=${result.skipped ? 'SKIPPED' : result.authenticated ? 'AUTHENTICATED' : 'NOT_AUTHENTICATED'}`,
      ].join(' '),
    );
    if (signals.evaluateError) {
      pushWorkerLog('error', `page_evaluate_error ${signals.evaluateError}`);
    }
    // When visible auth chrome is expected but selectors miss, dump attempts.
    if (
      !result.skipped &&
      !result.authenticated &&
      (!signals.hasAvatar || !signals.hasAccountName || !signals.hasEditProfile)
    ) {
      pushWorkerLog(
        'warn',
        [
          'auth_selector_mismatch — screenshot/HTML saved but DOM signals incomplete.',
          `attemptedSelectors=${(signals.attemptedSelectors || []).join(',') || 'none'}`,
        ].join(' '),
      );
    }
    for (const line of result.summary.split('\n')) {
      pushWorkerLog('info', `auth_score ${line}`);
    }
    return result;
  };

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

    const result = await evaluateOnce('poll');
    if (result.authenticated) {
      // AuthEvidenceEngine already scored cookies/storage/DOM — no URL heuristics.
      pushWorkerLog(
        'info',
        `login_wait_success sessionId=${session.id} portal=${session.portal} authScore=${result.score}/${result.threshold} sawLoginSurface=${detectState.sawLoginSurface}`,
      );
      await updateConnectSession(session.id, {
        message: CONNECT_USER_MESSAGES.authenticated,
      });
      return true;
    }

    poll += 1;
    await sleep(2000);
  }

  // Grace poll: if auth is visible after deadline but before cleanup, capture anyway.
  try {
    const late = await evaluateOnce('post_timeout_grace');
    if (late.authenticated) {
      pushWorkerLog(
        'warn',
        `login_wait_success_after_deadline portal=${session.portal} score=${late.score}/${late.threshold}`,
      );
      return true;
    }
    pushWorkerLog('error', `login_wait_timeout portal=${session.portal}\n${late.summary}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    pushWorkerLog('error', `login_wait_timeout_probe_failed portal=${session.portal} error=${message}`);
  }

  await transitionConnectSession({
    sessionId: session.id,
    to: 'failed',
    errorMessage: CONNECT_USER_MESSAGES.loginTimeout,
    message: CONNECT_USER_MESSAGES.loginTimeout,
    finishedAt: new Date().toISOString(),
    caller: 'waitForManualLogin.timeout',
  }).catch(async () => {
    await updateConnectSession(session.id, {
      phase: 'failed',
      errorMessage: CONNECT_USER_MESSAGES.loginTimeout,
      message: CONNECT_USER_MESSAGES.loginTimeout,
      finishedAt: new Date().toISOString(),
    });
  });
  pushWorkerLog(
    'error',
    `connect_failed sessionId=${session.id} portal=${session.portal} reason=login_timeout profileDir=${profileDir}`,
  );
  setWorkerError(CONNECT_USER_MESSAGES.loginTimeout);
  pushWorkerLog('info', `browser_close sessionId=${session.id} reason=login_timeout`);
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
  // Stale Chromium SingletonLock on Railway volume after redeploy.
  // Browser/page crashes must also retry with a fresh context/page.
  if (
    text.includes('profile appears to be in use') ||
    text.includes('singletonlock') ||
    text.includes('target page, context or browser has been closed') ||
    text.includes('page crashed') ||
    text.includes('target closed') ||
    text.includes('browser disconnected') ||
    text.includes('browser has been closed') ||
    text.includes('execution context was destroyed') ||
    text.includes('execution context destroyed') ||
    text.includes('session closed')
  ) {
    return true;
  }
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
    await transitionConnectSession({
      sessionId: connectId,
      to: 'validating',
      message: 'Re-validating encrypted session…',
      workerId: WORKER_ID,
      caller: 'runValidateOnly.validating',
    });
    const session = await findBrowserSession(workspaceId, portal);
    if (!session?.encryptedCookies) {
      await notifySessionNeedsLogin({ workspaceId, portal });
      await transitionConnectSession({
        sessionId: connectId,
        to: 'failed',
        errorMessage: 'No encrypted session to validate',
        finishedAt: new Date().toISOString(),
        caller: 'runValidateOnly.no_cookies',
      }).catch(async () => {
        await updateConnectSession(connectId, {
          phase: 'failed',
          errorMessage: 'No encrypted session to validate',
          finishedAt: new Date().toISOString(),
        });
      });
      return;
    }
    const result = await browserSessionManager.validateSession(session.id, { force: true });
    if (!result.ok) {
      await notifySessionNeedsLogin({ workspaceId, portal });
      await transitionConnectSession({
        sessionId: connectId,
        to: 'failed',
        errorMessage: result.message || 'Session invalid',
        finishedAt: new Date().toISOString(),
        caller: 'runValidateOnly.invalid',
      }).catch(async () => {
        await updateConnectSession(connectId, {
          phase: 'failed',
          errorMessage: result.message || 'Session invalid',
          finishedAt: new Date().toISOString(),
        });
      });
      return;
    }
    await upsertPortalConnection({
      workspaceId,
      portalKey: portal,
      portalName: portal,
      status: 'connected',
    });
    await transitionConnectSession({
      sessionId: connectId,
      to: 'connected',
      message: 'Session still valid',
      finishedAt: new Date().toISOString(),
      browserSessionId: session.id,
      validationOk: true,
      caller: 'runValidateOnly.validation_passed',
    });
    pushWorkerLog(
      'info',
      `connect_pipeline Validation Passed → Connected sessionId=${connectId} portal=${portal} caller=runValidateOnly`,
    );
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
  // Prefer full artifact/profile scavenger; fall back to connect-preview TTL sweep.
  try {
    const { scavengeBrowserProfiles, scavengeArtifacts } = await import(
      '@/lib/research/ops/scavenger'
    );
    const profiles = await scavengeBrowserProfiles();
    const artifacts = await scavengeArtifacts();
    return profiles + artifacts;
  } catch {
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
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
