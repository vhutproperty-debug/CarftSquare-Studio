/**
 * Probe whether an active Connect liveViewUrl is usable (HTML + WS upgrade).
 *   npx tsx scripts/probe-liveview.ts [connectSessionId]
 */
import fs from 'fs';
import path from 'path';
import http from 'http';
import https from 'https';

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

function fetchText(url: string): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: string }> {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    const req = lib.get(url, { headers: { Accept: '*/*' } }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () =>
        resolve({
          status: res.statusCode || 0,
          headers: res.headers,
          body: Buffer.concat(chunks).toString('utf8'),
        }),
      );
    });
    req.on('error', reject);
    req.setTimeout(20_000, () => {
      req.destroy(new Error('timeout'));
    });
  });
}

function probeWebSocket(liveViewUrl: string): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    const u = new URL(liveViewUrl);
    const viewMatch = u.pathname.match(/\/remote\/([a-f0-9]+)\//i);
    const viewId = viewMatch?.[1] || '';
    const token = u.searchParams.get('t') || '';
    const wsPath = `/remote/${viewId}/websockify?t=${encodeURIComponent(token)}`;
    const req = https.request(
      {
        hostname: u.hostname,
        path: wsPath,
        method: 'GET',
        headers: {
          Connection: 'Upgrade',
          Upgrade: 'websocket',
          'Sec-WebSocket-Version': '13',
          'Sec-WebSocket-Key': Buffer.from('probe-liveview-key-12').toString('base64'),
          Host: u.hostname,
        },
      },
      (res) => {
        resolve({
          ok: false,
          status: res.statusCode,
          headers: res.headers,
          note: 'expected 101 upgrade; got HTTP response',
        });
        res.resume();
      },
    );
    req.on('upgrade', (_res, socket) => {
      socket.destroy();
      resolve({ ok: true, upgraded: true, status: 101 });
    });
    req.on('error', (err) => resolve({ ok: false, error: err.message }));
    req.setTimeout(15_000, () => {
      req.destroy();
      resolve({ ok: false, error: 'ws timeout' });
    });
    req.end();
  });
}

async function main() {
  const id = process.argv[2];
  const { listConnectSessions, getConnectSessionById } = await import(
    '../lib/research/browser-gateway/connect-session-store'
  );

  let session = id ? await getConnectSessionById(id) : null;
  if (!session) {
    const active = await listConnectSessions('workspace-default', { activeOnly: true });
    session = active.find((s) => s.portal === 'magicbricks') || active[0] || null;
  }

  if (!session?.liveViewUrl) {
    console.log(
      JSON.stringify(
        {
          ok: false,
          error: 'No active Connect session with liveViewUrl',
          sessionId: session?.id || null,
          phase: session?.phase || null,
        },
        null,
        2,
      ),
    );
    process.exit(1);
  }

  const url = session.liveViewUrl;
  const html = await fetchText(url);
  const assetBase = url.split('?')[0].replace(/\/vnc\.html$/i, '');
  const appJs = await fetchText(`${assetBase}/app/app.js`).catch((e) => ({
    status: 0,
    headers: {},
    body: String(e),
  }));
  const ws = await probeWebSocket(url);

  const report = {
    ok: html.status === 200 && Boolean(ws.ok),
    sessionId: session.id,
    portal: session.portal,
    phase: session.phase,
    expiresAt: session.expiresAt,
    liveViewHost: new URL(url).host,
    isLocalhost: /127\.0\.0\.1|localhost/i.test(url),
    htmlStatus: html.status,
    htmlHasNoVnc: /noVNC/i.test(html.body),
    setCookie: html.headers['set-cookie'] || null,
    appJsStatus: appJs.status,
    websocket: ws,
    liveViewUrl: url,
  };

  const out = path.join(process.cwd(), 'tmp', 'research-smoke', 'liveview-probe.json');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 2);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
