/**
 * Production Connect smoke test — all five portals.
 * Accepts waiting_for_login + liveView OR failed with clear WAF/block message.
 * Cancels after observation so workers are not left waiting for OTP.
 *
 *   npx tsx scripts/smoke-connect-production.ts
 */
import fs from 'fs';
import path from 'path';

function loadEnvLocal() {
  try {
    const raw = fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
      if (!m) continue;
      let v = m[2].trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      if (!process.env[m[1]]) process.env[m[1]] = v;
    }
  } catch {
    /* optional */
  }
}

loadEnvLocal();

const PORTALS = ['housing', 'magicbricks', '99acres', 'nobroker', 'squareyards'] as const;

type SmokeRow = {
  portal: string;
  sessionId: string | null;
  phase: string | null;
  loginUrl: string | null;
  liveViewUrl: boolean;
  message: string | null;
  errorMessage: string | null;
  pass: boolean;
  reason: string;
  sawCrashRecover: boolean;
  falseConnected: boolean;
};

async function smokeOne(portal: string): Promise<SmokeRow> {
  const { startRemoteConnect, getConnectSessionPublic } = await import(
    '../lib/research/browser-gateway/gateway'
  );
  const { getPortalMeta } = await import('../lib/research/browser/config');
  const { updateConnectSession } = await import(
    '../lib/research/browser-gateway/connect-session-store'
  );
  const { fetchBrowserWorkerStatus } = await import(
    '../lib/research/browser-gateway/worker-client'
  );

  const meta = getPortalMeta(portal);
  const workerBefore = await fetchBrowserWorkerStatus();
  console.log(JSON.stringify({ step: 'start', portal, loginUrl: meta?.loginUrl, worker: workerBefore.online }));

  const { connectSession } = await startRemoteConnect({
    workspaceId: 'workspace-default',
    portal,
    createdBy: 'prod-smoke-connect',
  });

  const deadline = Date.now() + 180_000;
  let lastPhase = '';
  let final = await getConnectSessionPublic(connectSession.id);
  while (Date.now() < deadline) {
    final = await getConnectSessionPublic(connectSession.id);
    if (final?.phase && final.phase !== lastPhase) {
      lastPhase = final.phase;
      console.log(
        JSON.stringify({
          portal,
          id: final.id,
          phase: final.phase,
          message: final.message,
          errorMessage: final.errorMessage || null,
          liveView: Boolean(final.liveViewUrl),
        }),
      );
    }
    const phase = final?.phase || '';
    if (phase === 'waiting_for_login' && final?.liveViewUrl) break;
    if (['failed', 'cancelled', 'expired', 'connected'].includes(phase)) break;
    await new Promise((r) => setTimeout(r, 2500));
  }

  const logsRes = await fetch(
    `${process.env.RESEARCH_BROWSER_WORKER_URL?.replace(/\/$/, '') || 'https://unique-endurance-production-57a8.up.railway.app'}/logs?limit=120`,
  ).catch(() => null);
  const logsJson = logsRes && logsRes.ok ? await logsRes.json().catch(() => ({})) : {};
  const logLines: string[] = Array.isArray(logsJson.logs)
    ? logsJson.logs.map((l: { message?: string } | string) =>
        typeof l === 'string' ? l : String(l.message || ''),
      )
    : [];
  const scoped = logLines.filter((m) => m.includes(connectSession.id));
  const sawCrashRecover = scoped.some((m) => /browser_crash_recover/i.test(m));
  const sawNavBeforeLive =
    scoped.some((m) => /login_nav_before_liveview/.test(m)) &&
    scoped.some((m) => /publish_liveview_preflight/.test(m));
  const falseConnected = final?.phase === 'connected';

  const errText = `${final?.errorMessage || ''} ${final?.message || ''}`;
  const wafFail =
    final?.phase === 'failed' &&
    /blocked before login surface|access denied|security alert|waf|akamai|ERR_HTTP|Portal blocked this login page/i.test(
      errText,
    );
  const loginOk = final?.phase === 'waiting_for_login' && Boolean(final.liveViewUrl);
  // When logs still buffer the session, require nav-before-liveview evidence for loginOk.
  const pass =
    !falseConnected &&
    !sawCrashRecover &&
    (wafFail || (loginOk && (sawNavBeforeLive || scoped.length === 0)));
  const reason = loginOk
    ? sawNavBeforeLive || scoped.length === 0
      ? 'waiting_for_login with liveView (login surface published after nav)'
      : 'waiting_for_login but missing nav-before-liveview log evidence'
    : wafFail
      ? `clear WAF/block failure: ${errText.slice(0, 180)}`
      : `unexpected phase=${final?.phase} msg=${errText.slice(0, 160)}`;

  // Cancel so worker does not wait for OTP / hold the display.
  if (final && !['connected', 'failed', 'cancelled', 'expired'].includes(final.phase)) {
    await updateConnectSession(connectSession.id, {
      phase: 'cancelled',
      message: 'Cancelled by production smoke test',
      finishedAt: new Date().toISOString(),
    }).catch(() => undefined);
  }

  // Brief gap so worker can cleanup before next portal.
  await new Promise((r) => setTimeout(r, 4000));

  return {
    portal,
    sessionId: connectSession.id,
    phase: final?.phase || null,
    loginUrl: meta?.loginUrl || null,
    liveViewUrl: Boolean(final?.liveViewUrl),
    message: final?.message || null,
    errorMessage: final?.errorMessage || null,
    pass,
    reason,
    sawCrashRecover,
    falseConnected,
  };
}

async function main() {
  const workerUrl =
    process.env.RESEARCH_BROWSER_WORKER_URL ||
    'https://unique-endurance-production-57a8.up.railway.app';
  process.env.RESEARCH_BROWSER_WORKER_URL = workerUrl;

  const { fetchBrowserWorkerStatus } = await import(
    '../lib/research/browser-gateway/worker-client'
  );
  const worker = await fetchBrowserWorkerStatus();
  console.log(JSON.stringify({ workerUrl, online: worker.online, healthy: worker.healthy }));
  if (!worker.online) {
    console.error('Browser Worker offline — abort smoke');
    process.exit(1);
  }

  const rows: SmokeRow[] = [];
  for (const portal of PORTALS) {
    try {
      rows.push(await smokeOne(portal));
    } catch (e) {
      rows.push({
        portal,
        sessionId: null,
        phase: null,
        loginUrl: null,
        liveViewUrl: false,
        message: null,
        errorMessage: e instanceof Error ? e.message : String(e),
        pass: false,
        reason: `exception: ${e instanceof Error ? e.message : String(e)}`,
        sawCrashRecover: false,
        falseConnected: false,
      });
    }
  }

  const outDir = path.join(process.cwd(), 'tmp', 'prod-smoke');
  fs.mkdirSync(outDir, { recursive: true });
  const report = {
    at: new Date().toISOString(),
    commit: process.env.GIT_SHA || null,
    workerUrl,
    rows,
    passCount: rows.filter((r) => r.pass).length,
    failCount: rows.filter((r) => !r.pass).length,
  };
  fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.failCount > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
