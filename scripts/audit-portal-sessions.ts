/**
 * Read-only audit of portal sessions / connect flows for Research Ready triage.
 *   npx tsx scripts/audit-portal-sessions.ts
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
      if (
        (v.startsWith('"') && v.endsWith('"')) ||
        (v.startsWith("'") && v.endsWith("'"))
      ) {
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
const WORKSPACE = 'workspace-default';

async function main() {
  const { listBrowserSessions } = await import('../lib/research/sessions/session-store');
  const { listConnectSessions } = await import(
    '../lib/research/browser-gateway/connect-session-store'
  );
  const { findPortalConnection } = await import('../lib/research/store/portal-connections');
  const { listConnectorStatuses } = await import('../lib/research/browser-gateway/gateway');

  const sessions = await listBrowserSessions(WORKSPACE);
  const active = await listConnectSessions(WORKSPACE, { activeOnly: true });
  const recent = await listConnectSessions(WORKSPACE, {});
  const statuses = await listConnectorStatuses(WORKSPACE, { workerOnline: true });

  const rows = [];
  for (const portal of PORTALS) {
    const s = sessions.find((x) => x.portal === portal);
    const c = await findPortalConnection(WORKSPACE, portal);
    const card = statuses.connectors.find((x) => x.portal === portal);
    rows.push({
      portal,
      connectionStatus: c?.status || null,
      sessionStatus: s?.sessionStatus || null,
      hasCookies: Boolean(s?.encryptedCookies),
      hasStorage: Boolean(s?.encryptedStorage),
      cookieBytes: s?.encryptedCookies?.length || 0,
      lastVerified: s?.lastVerified || null,
      expiresAt: s?.expiresAt || null,
      lastValidationError: s?.lastValidationError || null,
      displayState: card?.displayState || null,
      availableForResearch: card?.availableForResearch || false,
      researchReady: card?.diagnostics?.researchReady || false,
      humanError: card?.humanError || null,
    });
  }

  const report = {
    at: new Date().toISOString(),
    rows,
    activeConnects: active.map((c) => ({
      id: c.id,
      portal: c.portal,
      phase: c.phase,
      message: c.message,
      updatedAt: c.updatedAt,
      createdAt: c.createdAt,
    })),
    recentConnects: recent.slice(0, 20).map((c) => ({
      portal: c.portal,
      phase: c.phase,
      message: (c.message || '').slice(0, 100),
      errorMessage: c.errorMessage || null,
      updatedAt: c.updatedAt,
    })),
  };

  const out = path.join(process.cwd(), 'tmp', 'research-smoke', 'session-audit.json');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
