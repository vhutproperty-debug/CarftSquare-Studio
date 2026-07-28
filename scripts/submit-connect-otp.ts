/**
 * Submit OTP for an active Connect session via the Next.js API
 * (worker consumes pendingOtp from Mongo).
 *
 *   npx tsx scripts/submit-connect-otp.ts --session=<id> --otp=123456
 *
 * Or pipe OTP when chatting with the agent:
 *   npx tsx scripts/submit-connect-otp.ts --portal=squareyards --otp=123456
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

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : undefined;
}

async function main() {
  const otp = String(arg('otp') || '').replace(/\D/g, '');
  let sessionId = arg('session') || arg('sessionId');
  const portal = arg('portal');
  const base = (process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'http://localhost:3000').replace(
    /\/$/,
    '',
  );
  const workspaceId = arg('workspaceId') || 'workspace-default';

  if (!otp || otp.length < 4) {
    console.error('Need --otp=<digits> (4–8 digits)');
    process.exit(2);
  }

  if (!sessionId && portal) {
    const { listConnectSessions } = await import(
      '@/lib/research/browser-gateway/connect-session-store'
    );
    const sessions = await listConnectSessions(workspaceId, {
      portal,
      activeOnly: true,
    });
    const waiting = sessions.find(
      (s) => s.phase === 'waiting_for_login' || s.phase === 'verifying',
    );
    sessionId = waiting?.id;
    if (!sessionId) {
      console.error(`No active waiting_for_login session for portal=${portal}`);
      process.exit(1);
    }
  }

  if (!sessionId) {
    console.error('Need --session=<connectSessionId> or --portal=<key>');
    process.exit(2);
  }

  // Prefer direct Mongo update (works without cookies / local Next server).
  const { getConnectSessionById, updateConnectSession, publicConnectSession } = await import(
    '@/lib/research/browser-gateway/connect-session-store'
  );
  const { usesConnectAuthEngine } = await import(
    '@/lib/research/browser-gateway/connect-auth-engine'
  );

  const session = await getConnectSessionById(sessionId);
  if (!session) {
    console.error('Session not found:', sessionId);
    process.exit(1);
  }
  if (!usesConnectAuthEngine(session.portal)) {
    console.error('OTP submit via chat is not used for portal:', session.portal);
    process.exit(1);
  }

  await updateConnectSession(sessionId, {
    pendingOtp: otp,
    pendingOtpAt: new Date().toISOString(),
    message: 'OTP received — entering into secure browser…',
    authChallenge: 'otp',
  });

  const updated = await getConnectSessionById(sessionId);
  console.log(
    JSON.stringify(
      {
        ok: true,
        sessionId,
        portal: session.portal,
        phase: updated?.phase,
        message: updated?.message,
        // never echo OTP
        connectSession: updated ? publicConnectSession(updated) : null,
        tip: `Worker will consume pendingOtp within ~2s. LiveView: ${updated?.liveViewUrl || 'n/a'}`,
        apiAlternative: `${base}/api/research/connectors/session/otp`,
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
