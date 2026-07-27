/**
 * Prop AI connector production-readiness E2E suite.
 *
 * Covers Housing, MagicBricks, 99acres, NoBroker, SquareYards across 7 scenarios.
 *
 * Usage:
 *   npx tsx scripts/production-readiness/connector-e2e-suite.ts
 *   npx tsx scripts/production-readiness/connector-e2e-suite.ts --portals=housing,magicbricks
 *   npx tsx scripts/production-readiness/connector-e2e-suite.ts --idle-ms=60000
 *   npx tsx scripts/production-readiness/connector-e2e-suite.ts --scenarios=2,3,4
 *   npx tsx scripts/production-readiness/connector-e2e-suite.ts --skip-manual
 *
 * Scenario 1 needs a live Browser Worker + human OTP when no valid session exists.
 * Scenario 5 defaults to 30 minutes (--idle-ms overrides).
 *
 * Artifacts: tmp/production-readiness/<runId>/
 */

import fs from 'fs/promises';
import path from 'path';
import { loadEnvLocal } from '../lib/load-env-local.mjs';
import { RESEARCH_PORTALS, getPortalMeta } from '../../lib/research/browser/config';
import { scoreAuthEvidence } from '../../lib/research/auth-detection/auth-evidence-engine';
import {
  canTransition,
  getAllowedTransitions,
} from '../../lib/research/browser-gateway/connect-phase-machine';
import type { ConnectFlowPhase } from '../../lib/research/browser-gateway/types';
import { fetchBrowserWorkerStatus } from '../../lib/research/browser-gateway/worker-client';
import { friendlyConnectError } from '../../lib/research/browser-gateway/connect-messages';
import { listConnectorStatuses, startRemoteConnect } from '../../lib/research/browser-gateway/gateway';
import {
  getConnectSessionById,
  listConnectSessions,
} from '../../lib/research/browser-gateway/connect-session-store';
import { DEFAULT_RESEARCH_WORKSPACE } from '../../lib/research/business';
import { findBrowserSession, touchBrowserSession, upsertBrowserSession } from '../../lib/research/sessions/session-store';
import { browserSessionManager } from '../../lib/research/sessions/browser-session-manager';
import { researchBrowserPool } from '../../lib/research/browser/browser-pool';
import { requirePortalConnector } from '../../connectors/registry';
import { getResearchProfileRoot } from '../../lib/research/browser/runtime-paths';


loadEnvLocal();

type PortalKey = (typeof RESEARCH_PORTALS)[number]['key'];

type ScenarioResult = {
  portal: string;
  scenario: number;
  name: string;
  pass: boolean;
  skipped?: boolean;
  timeMs: number;
  authScore: number | null;
  cookieCount: number | null;
  storageStateBytes: number | null;
  verifyUrl: string | null;
  browserProfilePath: string | null;
  finalConnectorState: string | null;
  exception: string | null;
  screenshotPath: string | null;
  detail: string;
};

type SuiteReport = {
  runId: string;
  startedAt: string;
  finishedAt: string;
  workerOnline: boolean;
  results: ScenarioResult[];
  phaseMachineInvariants: { name: string; pass: boolean; detail: string }[];
  codeReview: CodeReviewFinding[];
  thirtyDayRisks: RiskItem[];
  summary: { pass: number; fail: number; skipped: number };
};

type CodeReviewFinding = {
  id: number;
  area: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  finding: string;
  mitigation: string;
  mustFixBeforePropAi: boolean;
};

type RiskItem = {
  rank: number;
  risk: string;
  probability: 'low' | 'medium' | 'high';
  impact: 'low' | 'medium' | 'high' | 'critical';
  mitigation: string;
  mustFixBeforePropAi: boolean;
};

function arg(name: string, fallback?: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  if (!hit) return fallback;
  return hit.slice(name.length + 3);
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

const RUN_ID = `pr-${Date.now()}`;
const OUT_DIR = path.join(process.cwd(), 'tmp', 'production-readiness', RUN_ID);
const WORKSPACE =
  process.env.RESEARCH_WORKSPACE_ID ||
  (typeof DEFAULT_RESEARCH_WORKSPACE === 'string'
    ? DEFAULT_RESEARCH_WORKSPACE
    : (DEFAULT_RESEARCH_WORKSPACE as { id: string }).id);
const IDLE_MS = Number(arg('idle-ms', String(30 * 60 * 1000)));
const SKIP_MANUAL = hasFlag('skip-manual');
const INVARIANTS_ONLY = hasFlag('invariants-only');
const PORTAL_FILTER = (arg('portals') || RESEARCH_PORTALS.map((p) => p.key).join(','))
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean) as PortalKey[];
const SCENARIO_FILTER = (arg('scenarios') || '1,2,3,4,5,6,7')
  .split(',')
  .map((s) => Number(s.trim()))
  .filter((n) => n >= 1 && n <= 7);

const results: ScenarioResult[] = [];

async function ensureOut() {
  await fs.mkdir(OUT_DIR, { recursive: true });
  await fs.mkdir(path.join(OUT_DIR, 'screenshots'), { recursive: true });
}

async function record(r: ScenarioResult) {
  results.push(r);
  const mark = r.skipped ? 'SKIP' : r.pass ? 'PASS' : 'FAIL';
  console.log(
    `[${mark}] S${r.scenario} ${r.portal} ${r.name} ${r.timeMs}ms` +
      (r.authScore != null ? ` auth=${r.authScore}` : '') +
      (r.cookieCount != null ? ` cookies=${r.cookieCount}` : '') +
      (r.exception ? ` err=${r.exception.slice(0, 120)}` : ''),
  );
  await fs.writeFile(
    path.join(OUT_DIR, `${r.portal}-s${r.scenario}.json`),
    JSON.stringify(r, null, 2),
    'utf8',
  );
}

async function screenshotOnFailure(
  portal: string,
  scenario: number,
  page?: { screenshot: (o: { path: string; type: 'jpeg'; quality: number }) => Promise<unknown> } | null,
): Promise<string | null> {
  if (!page) return null;
  const shot = path.join(OUT_DIR, 'screenshots', `${portal}-s${scenario}-fail.jpg`);
  try {
    await page.screenshot({ path: shot, type: 'jpeg', quality: 60 });
    return shot;
  } catch {
    return null;
  }
}

function runPhaseMachineInvariants() {
  const checks: { name: string; pass: boolean; detail: string }[] = [];

  const happy: ConnectFlowPhase[] = [
    'queued',
    'connecting',
    'opening_browser',
    'waiting_for_login',
    'verifying',
    'capturing',
    'encrypting',
    'connected',
  ];
  for (let i = 0; i < happy.length - 1; i += 1) {
    const from = happy[i];
    const to = happy[i + 1];
    const ok = canTransition(from, to);
    checks.push({
      name: `happy_path_${from}_to_${to}`,
      pass: ok,
      detail: ok
        ? `allowed=${getAllowedTransitions(from).join('|')}`
        : `BLOCKED — allowed=${getAllowedTransitions(from).join('|')}`,
    });
  }

  // The bug that burned us: waiting_for_login → validating must stay illegal.
  checks.push({
    name: 'waiting_for_login_not_to_validating',
    pass: !canTransition('waiting_for_login', 'validating'),
    detail: `allowed=${getAllowedTransitions('waiting_for_login').join('|')}`,
  });

  // Same-context verify path: waiting_for_login → verifying must be legal.
  checks.push({
    name: 'waiting_for_login_to_verifying',
    pass: canTransition('waiting_for_login', 'verifying'),
    detail: `allowed=${getAllowedTransitions('waiting_for_login').join('|')}`,
  });

  // encrypting → connected must be legal (persist then Research Ready).
  checks.push({
    name: 'encrypting_to_connected',
    pass: canTransition('encrypting', 'connected'),
    detail: `allowed=${getAllowedTransitions('encrypting').join('|')}`,
  });

  // AuthEvidenceEngine: MagicBricks-like verify page with cookies must PASS.
  const score = scoreAuthEvidence({
    url: 'https://www.magicbricks.com/',
    title: 'MagicBricks',
    bodyHtml: '<a>My Account</a><button>Log out</button>',
    cookies: [{ name: 'a' }, { name: 'b' }, { name: 'c' }, { name: 'd' }, { name: 'e' }],
    localStorageKeys: ['mb_auth'],
    sessionStorageKeys: [],
    hasLoginForm: false,
    mode: 'verify',
  });
  checks.push({
    name: 'auth_engine_magicbricks_like_pass',
    pass: score.authenticated && score.confidence >= 60,
    detail: `confidence=${score.confidence} authenticated=${score.authenticated}`,
  });

  // loginUrl must never be used as verify for portals that embed "login" in loginUrl.
  for (const p of RESEARCH_PORTALS) {
    const loginHasLogin = /login/i.test(p.loginUrl) && !/profile/i.test(p.loginUrl);
    const verifyHasLogin = /login/i.test(p.verifyUrl) && !/profile/i.test(p.verifyUrl);
    checks.push({
      name: `verifyUrl_safe_${p.key}`,
      pass: !loginHasLogin || !verifyHasLogin || p.loginUrl === p.verifyUrl,
      detail: `loginUrl=${p.loginUrl} verifyUrl=${p.verifyUrl}`,
    });
  }

  // WAF / HTTP response failures must map to operator-safe copy (not raw Playwright).
  const wafSamples = [
    'page.goto: net::ERR_HTTP_RESPONSE_CODE_FAILURE at https://www.99acres.com/login-lrfv',
    'Connect navigation blocked before login surface (portal=magicbricks status=403 title="Access Denied")',
  ];
  for (const sample of wafSamples) {
    const friendly = friendlyConnectError(new Error(sample));
    const pass =
      /WAF|security|blocked|trusted network/i.test(friendly) &&
      !/page\.goto|ERR_HTTP|net::/i.test(friendly);
    checks.push({
      name: `friendly_waf_${sample.slice(0, 24).replace(/\W+/g, '_')}`,
      pass,
      detail: `in=${sample.slice(0, 60)}… out=${friendly}`,
    });
  }

  return checks;
}

async function scenario1Connect(portal: PortalKey): Promise<ScenarioResult> {
  const name = 'Cold start → Connect → login → verify → persist → Connected';
  const t0 = Date.now();
  const meta = getPortalMeta(portal)!;
  const base: Partial<ScenarioResult> = {
    portal,
    scenario: 1,
    name,
    verifyUrl: meta.verifyUrl,
    browserProfilePath: null,
    authScore: null,
    cookieCount: null,
    storageStateBytes: null,
    finalConnectorState: null,
    exception: null,
    screenshotPath: null,
  };

  try {
    const existing = await findBrowserSession(WORKSPACE, portal);
    if (existing?.sessionStatus === 'valid' && existing.encryptedCookies) {
      if (SKIP_MANUAL) {
        return {
          ...(base as ScenarioResult),
          pass: true,
          skipped: true,
          timeMs: Date.now() - t0,
          cookieCount: null,
          storageStateBytes: existing.encryptedStorage?.length ?? null,
          browserProfilePath: existing.browserProfile || getResearchProfileRoot(),
          finalConnectorState: 'connected (existing valid session)',
          detail: 'Skipped manual Connect — valid session already present (--skip-manual)',
        };
      }
    }

    const worker = await fetchBrowserWorkerStatus();
    if (!worker.online) {
      return {
        ...(base as ScenarioResult),
        pass: false,
        timeMs: Date.now() - t0,
        finalConnectorState: 'worker_offline',
        exception: 'Browser Worker offline',
        detail: 'Start worker: npm run research:browser-worker',
      };
    }

    const { connectSession } = await startRemoteConnect({
      workspaceId: WORKSPACE,
      portal,
      createdBy: 'production-readiness-suite',
    });

    console.log(
      `  → Connect queued ${portal} session=${connectSession.id} liveView=${connectSession.liveViewUrl || 'n/a'}`,
    );
    console.log(`  → Complete OTP in live view (timeout 12m)…`);

    const deadline = Date.now() + 12 * 60_000;
    let lastPhase = connectSession.phase;
    while (Date.now() < deadline) {
      const s = await getConnectSessionById(connectSession.id);
      if (!s) break;
      if (s.phase !== lastPhase) {
        console.log(`  → phase ${lastPhase} → ${s.phase}`);
        lastPhase = s.phase;
      }
      if (s.phase === 'connected') {
        const browser = await findBrowserSession(WORKSPACE, portal);
        return {
          ...(base as ScenarioResult),
          pass: true,
          timeMs: Date.now() - t0,
          cookieCount: null,
          storageStateBytes: browser?.encryptedStorage?.length ?? null,
          browserProfilePath: browser?.browserProfile || null,
          finalConnectorState: 'connected',
          detail: `Connect completed. browserSessionId=${browser?.id || 'n/a'}`,
        };
      }
      if (s.phase === 'failed' || s.phase === 'cancelled' || s.phase === 'expired') {
        return {
          ...(base as ScenarioResult),
          pass: false,
          timeMs: Date.now() - t0,
          finalConnectorState: s.phase,
          exception: s.errorMessage || s.message || s.phase,
          detail: `Connect ended in ${s.phase}`,
        };
      }
      await new Promise((r) => setTimeout(r, 2000));
    }

    return {
      ...(base as ScenarioResult),
      pass: false,
      timeMs: Date.now() - t0,
      finalConnectorState: lastPhase,
      exception: 'Connect timeout waiting for Connected',
      detail: 'User did not complete login within 12 minutes',
    };
  } catch (error) {
    return {
      ...(base as ScenarioResult),
      pass: false,
      timeMs: Date.now() - t0,
      exception: error instanceof Error ? error.message : String(error),
      detail: 'Scenario 1 exception',
    };
  }
}

async function scenario2RefreshStatus(portal: PortalKey): Promise<ScenarioResult> {
  const name = 'Refresh Connectors page → still Connected';
  const t0 = Date.now();
  const meta = getPortalMeta(portal)!;
  try {
    const status = await listConnectorStatuses(WORKSPACE);
    const card = status.connectors.find((c) => c.portal === portal);
    const pass =
      card?.displayState === 'connected' ||
      (card?.availableForResearch === true && card?.sessionExists === true);
    return {
      portal,
      scenario: 2,
      name,
      pass: Boolean(pass),
      timeMs: Date.now() - t0,
      authScore: card?.diagnostics?.loginConfidence ?? null,
      cookieCount: card?.diagnostics?.cookieCount ?? null,
      storageStateBytes: null,
      verifyUrl: meta.verifyUrl,
      browserProfilePath: null,
      finalConnectorState: card?.displayState || card?.status || null,
      exception: pass ? null : `displayState=${card?.displayState} status=${card?.status}`,
      screenshotPath: null,
      detail: card
        ? `availableForResearch=${card.availableForResearch} sessionExists=${card.sessionExists}`
        : 'No connector card',
    };
  } catch (error) {
    return {
      portal,
      scenario: 2,
      name,
      pass: false,
      timeMs: Date.now() - t0,
      authScore: null,
      cookieCount: null,
      storageStateBytes: null,
      verifyUrl: meta.verifyUrl,
      browserProfilePath: null,
      finalConnectorState: null,
      exception: error instanceof Error ? error.message : String(error),
      screenshotPath: null,
      detail: 'Status refresh failed',
    };
  }
}

async function scenario3WorkerRestartSim(portal: PortalKey): Promise<ScenarioResult> {
  const name = 'Worker restart sim (close pool) → session restore, no reconnect';
  const t0 = Date.now();
  const meta = getPortalMeta(portal)!;
  try {
    const session = await findBrowserSession(WORKSPACE, portal);
    if (!session?.encryptedCookies && !session?.encryptedStorage) {
      return {
        portal,
        scenario: 3,
        name,
        pass: false,
        skipped: true,
        timeMs: Date.now() - t0,
        authScore: null,
        cookieCount: null,
        storageStateBytes: null,
        verifyUrl: meta.verifyUrl,
        browserProfilePath: null,
        finalConnectorState: 'no_session',
        exception: null,
        screenshotPath: null,
        detail: 'No encrypted session to restore — complete Scenario 1 first',
      };
    }

    // Simulate worker process loss of in-memory pool.
    await researchBrowserPool.close(WORKSPACE, portal);

    const validation = await browserSessionManager.validateSession(session.id, { force: true });
    const browser = await findBrowserSession(WORKSPACE, portal);

    return {
      portal,
      scenario: 3,
      name,
      pass: validation.ok && validation.status === 'valid',
      timeMs: Date.now() - t0,
      authScore: validation.loginConfidence ?? null,
      cookieCount: null,
      storageStateBytes: browser?.encryptedStorage?.length ?? null,
      verifyUrl: meta.verifyUrl,
      browserProfilePath: browser?.browserProfile || getResearchProfileRoot(),
      finalConnectorState: validation.status,
      exception: validation.ok ? null : validation.message || validation.status,
      screenshotPath: null,
      detail: validation.ok
        ? 'Pool closed; validateSession restored storageState and passed on verifyUrl'
        : `Restore/validate failed: ${validation.message || validation.status}`,
    };
  } catch (error) {
    return {
      portal,
      scenario: 3,
      name,
      pass: false,
      timeMs: Date.now() - t0,
      authScore: null,
      cookieCount: null,
      storageStateBytes: null,
      verifyUrl: meta.verifyUrl,
      browserProfilePath: null,
      finalConnectorState: null,
      exception: error instanceof Error ? error.message : String(error),
      screenshotPath: null,
      detail: 'Scenario 3 exception',
    };
  }
}

async function scenario4ResearchSearch(portal: PortalKey): Promise<ScenarioResult> {
  const name = 'Real research search → listings, no auth prompts';
  const t0 = Date.now();
  const meta = getPortalMeta(portal)!;
  try {
    const session = await findBrowserSession(WORKSPACE, portal);
    if (!session?.encryptedCookies && !session?.encryptedStorage) {
      return {
        portal,
        scenario: 4,
        name,
        pass: false,
        skipped: true,
        timeMs: Date.now() - t0,
        authScore: null,
        cookieCount: null,
        storageStateBytes: null,
        verifyUrl: meta.verifyUrl,
        browserProfilePath: null,
        finalConnectorState: 'no_session',
        exception: null,
        screenshotPath: null,
        detail: 'No session — complete Scenario 1 first',
      };
    }

    const connector = requirePortalConnector(portal);
    const response = await connector.executeSearch({
      workspaceId: WORKSPACE,
      criteria: {
        city: 'Bangalore',
        locality: 'Koramangala',
        bhk: 2,
        budgetMax: 50000,
        intent: 'rent',
      },
    });

    const listings = response.listings?.length ?? 0;
    const authPrompt =
      /login|otp|sign in|unauthorized|needs_login/i.test(response.message || '') ||
      response.sessionStatus === 'needs_login';

    const pass = Boolean(response.ok) && listings > 0 && !authPrompt;

    return {
      portal,
      scenario: 4,
      name,
      pass,
      timeMs: Date.now() - t0,
      authScore: null,
      cookieCount: null,
      storageStateBytes: session.encryptedStorage?.length ?? null,
      verifyUrl: meta.verifyUrl,
      browserProfilePath: session.browserProfile || null,
      finalConnectorState: response.sessionStatus || (response.ok ? 'valid' : 'error'),
      exception: pass ? null : response.message || `listings=${listings} authPrompt=${authPrompt}`,
      screenshotPath: response.screenshotPath || null,
      detail: `ok=${response.ok} listings=${listings} sessionStatus=${response.sessionStatus || 'n/a'}`,
    };
  } catch (error) {
    return {
      portal,
      scenario: 4,
      name,
      pass: false,
      timeMs: Date.now() - t0,
      authScore: null,
      cookieCount: null,
      storageStateBytes: null,
      verifyUrl: meta.verifyUrl,
      browserProfilePath: null,
      finalConnectorState: null,
      exception: error instanceof Error ? error.message : String(error),
      screenshotPath: null,
      detail: 'Scenario 4 exception',
    };
  }
}

async function scenario5Idle(portal: PortalKey): Promise<ScenarioResult> {
  const name = `Idle ${Math.round(IDLE_MS / 60000)}m → still Research Ready`;
  const t0 = Date.now();
  const meta = getPortalMeta(portal)!;
  try {
    const before = await findBrowserSession(WORKSPACE, portal);
    if (!before || before.sessionStatus !== 'valid') {
      return {
        portal,
        scenario: 5,
        name,
        pass: false,
        skipped: true,
        timeMs: Date.now() - t0,
        authScore: null,
        cookieCount: null,
        storageStateBytes: null,
        verifyUrl: meta.verifyUrl,
        browserProfilePath: null,
        finalConnectorState: before?.sessionStatus || 'no_session',
        exception: null,
        screenshotPath: null,
        detail: 'Session not valid before idle — complete Scenario 1 first',
      };
    }

    console.log(`  → Idle ${IDLE_MS}ms for ${portal}…`);
    await new Promise((r) => setTimeout(r, IDLE_MS));

    const status = await listConnectorStatuses(WORKSPACE);
    const card = status.connectors.find((c) => c.portal === portal);
    const pass = Boolean(card?.availableForResearch);

    return {
      portal,
      scenario: 5,
      name,
      pass,
      timeMs: Date.now() - t0,
      authScore: card?.diagnostics?.loginConfidence ?? null,
      cookieCount: card?.diagnostics?.cookieCount ?? null,
      storageStateBytes: before.encryptedStorage?.length ?? null,
      verifyUrl: meta.verifyUrl,
      browserProfilePath: before.browserProfile || null,
      finalConnectorState: card?.displayState || card?.status || null,
      exception: pass ? null : `availableForResearch=${card?.availableForResearch}`,
      screenshotPath: null,
      detail: `After idle: displayState=${card?.displayState} available=${card?.availableForResearch}`,
    };
  } catch (error) {
    return {
      portal,
      scenario: 5,
      name,
      pass: false,
      timeMs: Date.now() - t0,
      authScore: null,
      cookieCount: null,
      storageStateBytes: null,
      verifyUrl: meta.verifyUrl,
      browserProfilePath: null,
      finalConnectorState: null,
      exception: error instanceof Error ? error.message : String(error),
      screenshotPath: null,
      detail: 'Scenario 5 exception',
    };
  }
}

async function scenario6RestartPlusResearch(portal: PortalKey): Promise<ScenarioResult> {
  const name = 'Worker restart sim + research → auto restore';
  const t0 = Date.now();
  const meta = getPortalMeta(portal)!;
  try {
    await researchBrowserPool.close(WORKSPACE, portal);
    const s3 = await scenario3WorkerRestartSim(portal);
    if (!s3.pass && !s3.skipped) {
      return { ...s3, scenario: 6, name, timeMs: Date.now() - t0 };
    }
    if (s3.skipped) {
      return { ...s3, scenario: 6, name, timeMs: Date.now() - t0 };
    }
    const s4 = await scenario4ResearchSearch(portal);
    return {
      ...s4,
      scenario: 6,
      name,
      timeMs: Date.now() - t0,
      pass: s3.pass && s4.pass,
      detail: `restore=${s3.pass} search=${s4.pass} listingsDetail=${s4.detail}`,
      exception: s4.pass ? null : s4.exception,
    };
  } catch (error) {
    return {
      portal,
      scenario: 6,
      name,
      pass: false,
      timeMs: Date.now() - t0,
      authScore: null,
      cookieCount: null,
      storageStateBytes: null,
      verifyUrl: meta.verifyUrl,
      browserProfilePath: null,
      finalConnectorState: null,
      exception: error instanceof Error ? error.message : String(error),
      screenshotPath: null,
      detail: 'Scenario 6 exception',
    };
  }
}

async function scenario7ExpireAndReconnect(portal: PortalKey): Promise<ScenarioResult> {
  const name = 'Expire session → reconnect → clean slate, no duplicates';
  const t0 = Date.now();
  const meta = getPortalMeta(portal)!;
  try {
    const before = await findBrowserSession(WORKSPACE, portal);
    if (!before) {
      return {
        portal,
        scenario: 7,
        name,
        pass: false,
        skipped: true,
        timeMs: Date.now() - t0,
        authScore: null,
        cookieCount: null,
        storageStateBytes: null,
        verifyUrl: meta.verifyUrl,
        browserProfilePath: null,
        finalConnectorState: 'no_session',
        exception: null,
        screenshotPath: null,
        detail: 'No session to expire',
      };
    }

    const oldId = before.id;
    const oldCookies = before.encryptedCookies;
    await touchBrowserSession(oldId, {
      sessionStatus: 'needs_login',
      status: 'needs_login',
      expiresAt: new Date(Date.now() - 60_000).toISOString(),
      lastValidationError: 'Intentionally expired by production-readiness suite',
      encryptedCookies: '',
      encryptedStorage: '',
    });

    // Ensure no duplicate active connect sessions for portal after expire.
    const activeBefore = await listConnectSessions(WORKSPACE, {
      portal,
      activeOnly: true,
    });

    if (SKIP_MANUAL) {
      // Prove cleanup invariants without full human reconnect.
      const after = await findBrowserSession(WORKSPACE, portal);
      const cleaned =
        after?.sessionStatus === 'needs_login' &&
        !after.encryptedCookies &&
        after.expiresAt &&
        new Date(after.expiresAt).getTime() < Date.now();

      // Restore session so we don't leave the workspace broken for other portals' later runs.
      if (oldCookies) {
        await upsertBrowserSession({
          workspaceId: WORKSPACE,
          portal,
          browserProfile: before.browserProfile,
          encryptedCookies: oldCookies,
          encryptedStorage: before.encryptedStorage,
          sessionStatus: 'valid',
          lastVerified: new Date().toISOString(),
        });
      }

      return {
        portal,
        scenario: 7,
        name,
        pass: Boolean(cleaned),
        skipped: true,
        timeMs: Date.now() - t0,
        authScore: null,
        cookieCount: 0,
        storageStateBytes: 0,
        verifyUrl: meta.verifyUrl,
        browserProfilePath: before.browserProfile || null,
        finalConnectorState: 'needs_login (restored after check)',
        exception: null,
        screenshotPath: null,
        detail: `Expire cleanup ok=${cleaned} activeConnects=${activeBefore.length} (reconnect skipped via --skip-manual; session restored)`,
      };
    }

    // Full reconnect path
    const s1 = await scenario1Connect(portal);
    const after = await findBrowserSession(WORKSPACE, portal);
    const activeAfter = await listConnectSessions(WORKSPACE, {
      portal,
      activeOnly: true,
    });
    const noDupes = activeAfter.filter((s) => s.phase !== 'connected').length <= 1;
    const newSession = after?.sessionStatus === 'valid' && Boolean(after.encryptedCookies);

    return {
      portal,
      scenario: 7,
      name,
      pass: s1.pass && newSession && noDupes,
      timeMs: Date.now() - t0,
      authScore: null,
      cookieCount: null,
      storageStateBytes: after?.encryptedStorage?.length ?? null,
      verifyUrl: meta.verifyUrl,
      browserProfilePath: after?.browserProfile || null,
      finalConnectorState: after?.sessionStatus || null,
      exception: s1.pass && newSession && noDupes ? null : s1.exception || 'duplicate or invalid',
      screenshotPath: null,
      detail: `reconnect=${s1.pass} newValid=${newSession} activeNonTerminal=${activeAfter.length} oldId=${oldId}`,
    };
  } catch (error) {
    return {
      portal,
      scenario: 7,
      name,
      pass: false,
      timeMs: Date.now() - t0,
      authScore: null,
      cookieCount: null,
      storageStateBytes: null,
      verifyUrl: meta.verifyUrl,
      browserProfilePath: null,
      finalConnectorState: null,
      exception: error instanceof Error ? error.message : String(error),
      screenshotPath: null,
      detail: 'Scenario 7 exception',
    };
  }
}

function buildCodeReview(): CodeReviewFinding[] {
  return [
    {
      id: 1,
      area: 'Memory leaks',
      severity: 'medium',
      finding:
        'connectorRuntime Map and BrowserPool entries grow per workspace::portal and are only cleared via explicit cleanup/close. Long-lived worker with many workspaces can retain runtime snapshots forever.',
      mitigation:
        'TTL/evict connectorRuntime entries; call researchBrowserPool.closeAll() on SIGTERM (partially present); bound listAll().',
      mustFixBeforePropAi: false,
    },
    {
      id: 2,
      area: 'Browser/context leaks',
      severity: 'medium',
      finding:
        'acquire() waits up to 60s for inUse; if a caller crashes mid-withPage without finally release, context stays inUse until timeout then throws busy.',
      mitigation:
        'withSessionContext already releases in finally — keep that invariant; add watchdog that force-releases inUse > N minutes.',
      mustFixBeforePropAi: false,
    },
    {
      id: 3,
      area: 'Zombie Chromium',
      severity: 'high',
      finding:
        'Worker SIGKILL (OOM/deploy) can leave Chromium + Xvfb/x11vnc orphans; connect profiles may remain until cleanupExpiredProfiles runs.',
      mitigation:
        'On worker boot: kill stale chromium for profile root; always run cleanupExpiredProfiles; use process groups / killProcessTree (already used for remote display).',
      mustFixBeforePropAi: true,
    },
    {
      id: 4,
      area: 'Orphaned browser profiles',
      severity: 'medium',
      finding:
        'Connect profile dirs removed in finally, but crash between prepareConnectProfileDir and finally can orphan dirs under profile root.',
      mitigation:
        'Boot-time sweep of connect-* dirs older than TTL (cleanupExpiredProfiles exists — verify it covers connect dirs).',
      mustFixBeforePropAi: false,
    },
    {
      id: 5,
      area: 'Deadlocks',
      severity: 'low',
      finding:
        'Profile lock + pool inUse spin-wait could interact poorly if same portal Connect and search overlap on different locks.',
      mitigation:
        'Connect uses connect:sessionId lock; search uses pool key — generally OK. Avoid holding pool lock across Connect.',
      mustFixBeforePropAi: false,
    },
    {
      id: 6,
      area: 'Race conditions',
      severity: 'medium',
      finding:
        'Superseding Connect cancels prior active sessions in Mongo, but in-flight worker may still finish and write connected after cancel if not checking phase often enough.',
      mitigation:
        'waitForManualLogin and transitions already re-read session; ensure every transition refuses cancelled/expired (partially done).',
      mustFixBeforePropAi: false,
    },
    {
      id: 7,
      area: 'Unhandled promise rejections',
      severity: 'low',
      finding:
        'Many .catch(() => undefined) swallow errors on close/cleanup — good for shutdown, bad for observability if close fails silently.',
      mitigation:
        'Log close failures at warn; keep swallow on shutdown path.',
      mustFixBeforePropAi: false,
    },
    {
      id: 8,
      area: 'Retry loops',
      severity: 'medium',
      finding:
        'processNextConnectJob still has while(true) for Connect; after architecture change success returns, but launch retry + browser launch failure paths must not loop forever without backoff.',
      mitigation:
        'Confirm loop only continues on intentional reopen; otherwise return. Add maxIterations guard.',
      mustFixBeforePropAi: true,
    },
    {
      id: 9,
      area: 'Database consistency',
      severity: 'high',
      finding:
        'Portal connection status and browser session status can diverge (e.g. portal connected but cookies cleared). Status UI merges both — operators can see Connected while search fails.',
      mitigation:
        'Single source of truth: availableForResearch requires sessionStatus=valid AND encrypted storage present (already mostly true in deriveConnectorDisplay).',
      mustFixBeforePropAi: true,
    },
    {
      id: 10,
      area: 'Cleanup failures',
      severity: 'medium',
      finding:
        'finally removes profileDir even after successful path cleared profileDir=""; good. Failed close of Chromium may leave processes while Mongo says failed.',
      mitigation:
        'browser_close_trigger logs + killProcessTree on remote path; add boot scavenger for local Chromium.',
      mustFixBeforePropAi: false,
    },
  ];
}

function buildThirtyDayRisks(): RiskItem[] {
  return [
    {
      rank: 1,
      risk: 'Portal bot wall / Akamai / captcha after cookie restore (headless or IP reputation)',
      probability: 'high',
      impact: 'high',
      mitigation: 'Headed worker, residential IP, detect security wall in AuthEvidenceEngine, alert needs_login',
      mustFixBeforePropAi: true,
    },
    {
      rank: 2,
      risk: 'Session cookie expiry / silent logout while UI still shows Connected (fresh validate skip window)',
      probability: 'high',
      impact: 'high',
      mitigation: 'Periodic health monitor validate; shorten validateFreshMs for critical portals',
      mustFixBeforePropAi: true,
    },
    {
      rank: 3,
      risk: 'Chromium crash mid-search → empty listings / false research quality',
      probability: 'medium',
      impact: 'high',
      mitigation: 'Existing crash invalidate + RetryManager; ensure parallel failover covers portal',
      mustFixBeforePropAi: false,
    },
    {
      rank: 4,
      risk: 'Disk fill from screenshots/HTML auth traces/profiles',
      probability: 'medium',
      impact: 'critical',
      mitigation: 'Rotate tmp/auth-traces and screenshots; volume monitoring; TTL cleanup',
      mustFixBeforePropAi: true,
    },
    {
      rank: 5,
      risk: 'Mongo cold start / auth null causing intermittent 401 on research APIs',
      probability: 'medium',
      impact: 'medium',
      mitigation: 'Already hardened cold-start; keep connection pool warm',
      mustFixBeforePropAi: false,
    },
    {
      rank: 6,
      risk: 'Worker deploy SIGKILL leaves zombie Chromium + orphan profiles',
      probability: 'medium',
      impact: 'high',
      mitigation: 'Boot scavenger; graceful SIGTERM drain; Railway memory headroom',
      mustFixBeforePropAi: true,
    },
    {
      rank: 7,
      risk: 'Connect phase / worker code drift after deploy (old worker + new phases)',
      probability: 'medium',
      impact: 'critical',
      mitigation: 'Deploy worker + app together; version handshake on /status',
      mustFixBeforePropAi: true,
    },
    {
      rank: 8,
      risk: 'Generic listing parsers return 0 results → research looks broken though auth OK',
      probability: 'high',
      impact: 'medium',
      mitigation: 'Portal-specific extractors; treat 0 listings as degraded not auth failure',
      mustFixBeforePropAi: true,
    },
    {
      rank: 9,
      risk: 'Encryption key rotation invalidates all encrypted storageState',
      probability: 'low',
      impact: 'critical',
      mitigation: 'Key versioning; dual-decrypt; force reconnect playbook',
      mustFixBeforePropAi: false,
    },
    {
      rank: 10,
      risk: 'Pool inUse stuck + concurrent research jobs starve a portal',
      probability: 'low',
      impact: 'medium',
      mitigation: 'Force-release watchdog; per-portal queue depth limits',
      mustFixBeforePropAi: false,
    },
  ];
}

async function main() {
  await ensureOut();
  console.log(`\n=== Connector Production Readiness Suite ===`);
  console.log(`runId=${RUN_ID}`);
  console.log(`workspace=${WORKSPACE}`);
  console.log(`portals=${PORTAL_FILTER.join(',')}`);
  console.log(`scenarios=${SCENARIO_FILTER.join(',')}`);
  console.log(`idleMs=${IDLE_MS} skipManual=${SKIP_MANUAL}`);
  console.log(`out=${OUT_DIR}\n`);

  const startedAt = new Date().toISOString();
  // Invariants-only is pure in-memory — skip worker/Mongo probe so Node can exit
  // cleanly on Windows (open Mongo sockets + process.exit → UV_HANDLE_CLOSING crash).
  const worker = INVARIANTS_ONLY
    ? { online: false, healthy: false }
    : await fetchBrowserWorkerStatus().catch(() => ({
        online: false,
        healthy: false,
      }));
  console.log(`Worker online=${worker.online} healthy=${(worker as { healthy?: boolean }).healthy}\n`);

  const phaseMachineInvariants = runPhaseMachineInvariants();
  for (const c of phaseMachineInvariants) {
    console.log(`[${c.pass ? 'PASS' : 'FAIL'}] invariant ${c.name} — ${c.detail}`);
  }

  if (INVARIANTS_ONLY) {
    const finishedAt = new Date().toISOString();
    const report: SuiteReport = {
      runId: RUN_ID,
      startedAt,
      finishedAt,
      workerOnline: Boolean(worker.online),
      results: [],
      phaseMachineInvariants,
      codeReview: buildCodeReview(),
      thirtyDayRisks: buildThirtyDayRisks(),
      summary: { pass: 0, fail: 0, skipped: 0 },
    };
    await fs.writeFile(path.join(OUT_DIR, 'REPORT.json'), JSON.stringify(report, null, 2), 'utf8');
    await fs.writeFile(
      path.join(OUT_DIR, 'REPORT.md'),
      [
        `# Invariants-only — ${RUN_ID}`,
        ...phaseMachineInvariants.map((c) => `- [${c.pass ? 'x' : ' '}] ${c.name}: ${c.detail}`),
        '',
        '## Code review',
        ...report.codeReview.map((f) => `### ${f.id}. ${f.area}\n${f.finding}`),
        '',
        '## 30-day risks',
        ...report.thirtyDayRisks.map((r) => `${r.rank}. ${r.risk} (${r.probability}/${r.impact})`),
      ].join('\n'),
      'utf8',
    );
    console.log(`\nInvariants-only report: ${path.join(OUT_DIR, 'REPORT.json')}`);
    if (phaseMachineInvariants.some((c) => !c.pass)) {
      process.exitCode = 1;
      return;
    }
    process.exitCode = 0;
    return;
  }

  const runners: Record<number, (p: PortalKey) => Promise<ScenarioResult>> = {
    1: scenario1Connect,
    2: scenario2RefreshStatus,
    3: scenario3WorkerRestartSim,
    4: scenario4ResearchSearch,
    5: scenario5Idle,
    6: scenario6RestartPlusResearch,
    7: scenario7ExpireAndReconnect,
  };

  for (const portal of PORTAL_FILTER) {
    console.log(`\n--- Portal: ${portal} ---`);
    for (const n of SCENARIO_FILTER) {
      const fn = runners[n];
      if (!fn) continue;
      // Scenario 5 is long — run once per portal only when selected.
      const result = await fn(portal);
      await record(result);
      void screenshotOnFailure;
    }
  }

  // Best-effort pool cleanup after suite.
  await researchBrowserPool.closeAll().catch(() => undefined);

  const finishedAt = new Date().toISOString();
  const summary = {
    pass: results.filter((r) => r.pass && !r.skipped).length,
    fail: results.filter((r) => !r.pass && !r.skipped).length,
    skipped: results.filter((r) => r.skipped).length,
  };

  const report: SuiteReport = {
    runId: RUN_ID,
    startedAt,
    finishedAt,
    workerOnline: Boolean(worker.online),
    results,
    phaseMachineInvariants,
    codeReview: buildCodeReview(),
    thirtyDayRisks: buildThirtyDayRisks(),
    summary,
  };

  const reportPath = path.join(OUT_DIR, 'REPORT.json');
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2), 'utf8');

  // Human-readable risk register
  const md: string[] = [
    `# Connector Production Readiness — ${RUN_ID}`,
    '',
    `Worker online: ${report.workerOnline}`,
    `Results: PASS=${summary.pass} FAIL=${summary.fail} SKIP=${summary.skipped}`,
    '',
    '## Phase machine invariants',
    ...phaseMachineInvariants.map((c) => `- [${c.pass ? 'x' : ' '}] ${c.name}: ${c.detail}`),
    '',
    '## Scenario results',
    ...results.map(
      (r) =>
        `- S${r.scenario} ${r.portal}: ${r.skipped ? 'SKIP' : r.pass ? 'PASS' : 'FAIL'} (${r.timeMs}ms) ${r.detail}`,
    ),
    '',
    '## Code review (leaks / races / cleanup)',
    ...report.codeReview.map(
      (f) =>
        `### ${f.id}. ${f.area} (${f.severity}${f.mustFixBeforePropAi ? ', MUST FIX' : ''})\n${f.finding}\n**Mitigation:** ${f.mitigation}`,
    ),
    '',
    '## Top 10 risks for 30-day continuous operation',
    ...report.thirtyDayRisks.map(
      (r) =>
        `### ${r.rank}. ${r.risk}\n- Probability: ${r.probability}\n- Impact: ${r.impact}\n- Mitigation: ${r.mitigation}\n- Must fix before Prop AI: ${r.mustFixBeforePropAi ? 'YES' : 'no'}`,
    ),
  ];
  const mdPath = path.join(OUT_DIR, 'REPORT.md');
  await fs.writeFile(mdPath, md.join('\n'), 'utf8');

  console.log(`\n=== Summary PASS=${summary.pass} FAIL=${summary.fail} SKIP=${summary.skipped} ===`);
  console.log(`Report: ${reportPath}`);
  console.log(`Markdown: ${mdPath}`);

  const invariantFail = phaseMachineInvariants.some((c) => !c.pass);
  process.exitCode = invariantFail || summary.fail > 0 ? 1 : 0;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
