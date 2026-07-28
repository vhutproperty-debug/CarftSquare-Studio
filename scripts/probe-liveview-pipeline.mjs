/**
 * Probe the LiveView rendering pipeline end-to-end:
 *  1. GET vnc.html (signed token) → capture Set-Cookie
 *  2. Parse referenced assets (src/href/import) → GET each with cookie
 *  3. WebSocket upgrade handshake to /remote/:viewId/websockify
 *
 * Usage: node scripts/probe-liveview-pipeline.mjs "<liveViewUrl>"
 */
import https from 'https';
import crypto from 'crypto';

const liveViewUrl = process.argv[2];
if (!liveViewUrl) {
  console.error('Usage: node scripts/probe-liveview-pipeline.mjs "<liveViewUrl>"');
  process.exit(2);
}

const u = new URL(liveViewUrl);
const base = `${u.protocol}//${u.host}`;
const viewPath = u.pathname.replace(/\/vnc\.html$/, '');

function get(url, cookie) {
  return new Promise((resolve) => {
    https
      .get(url, { headers: cookie ? { Cookie: cookie } : {} }, (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () =>
          resolve({
            status: res.statusCode,
            ctype: res.headers['content-type'] || '',
            setCookie: res.headers['set-cookie'] || [],
            body: Buffer.concat(chunks).toString('utf8'),
          }),
        );
      })
      .on('error', (e) => resolve({ status: 0, ctype: '', setCookie: [], body: String(e) }));
  });
}

function wsHandshake(pathWithQuery, cookie) {
  return new Promise((resolve) => {
    const key = crypto.randomBytes(16).toString('base64');
    const req = https.request({
      hostname: u.host,
      path: pathWithQuery,
      headers: {
        Connection: 'Upgrade',
        Upgrade: 'websocket',
        'Sec-WebSocket-Version': '13',
        'Sec-WebSocket-Key': key,
        'Sec-WebSocket-Protocol': 'binary',
        ...(cookie ? { Cookie: cookie } : {}),
      },
    });
    const timer = setTimeout(() => {
      req.destroy();
      resolve({ ok: false, detail: 'timeout waiting for upgrade' });
    }, 15000);
    req.on('upgrade', (res, socket) => {
      clearTimeout(timer);
      socket.destroy();
      resolve({ ok: true, status: 101, protocol: res.headers['sec-websocket-protocol'] || null });
    });
    req.on('response', (res) => {
      clearTimeout(timer);
      resolve({ ok: false, status: res.statusCode, detail: 'no upgrade — HTTP response' });
    });
    req.on('error', (e) => {
      clearTimeout(timer);
      resolve({ ok: false, detail: e.message });
    });
    req.end();
  });
}

const out = { at: new Date().toISOString(), base, viewPath, steps: {} };

// 1. vnc.html with token
const page = await get(liveViewUrl);
const cookie = page.setCookie.map((c) => c.split(';')[0]).join('; ');
out.steps.vncHtml = {
  status: page.status,
  ctype: page.ctype,
  bytes: page.body.length,
  gotCookie: Boolean(cookie),
  titleMatch: /<title>([^<]*)<\/title>/.exec(page.body)?.[1] || null,
};

// 2. referenced assets
const refs = new Set();
for (const m of page.body.matchAll(/(?:src|href)="([^"]+)"/g)) {
  const v = m[1];
  if (/^https?:|^data:|^#/.test(v)) continue;
  refs.add(v.replace(/^\.\//, ''));
}
for (const m of page.body.matchAll(/import\s+[^'"]*['"]([^'"]+)['"]/g)) {
  const v = m[1];
  if (/^https?:/.test(v)) continue;
  refs.add(v.replace(/^\.\//, ''));
}
out.steps.assets = [];
for (const rel of [...refs].slice(0, 25)) {
  const res = await get(`${base}${viewPath}/${rel}`, cookie);
  out.steps.assets.push({ rel, status: res.status, ctype: res.ctype, bytes: res.body.length });
}

// Deep import: core/rfb.js is what actually drives the canvas.
for (const rel of ['core/rfb.js', 'app/ui.js', 'app/error-handler.js']) {
  if ([...refs].includes(rel)) continue;
  const res = await get(`${base}${viewPath}/${rel}`, cookie);
  out.steps.assets.push({ rel: `(deep) ${rel}`, status: res.status, ctype: res.ctype, bytes: res.body.length });
}

// 3. websocket
const q = u.search; // reuse token
out.steps.websocket = await wsHandshake(`${viewPath}/websockify${q}`, cookie);

console.log(JSON.stringify(out, null, 2));
