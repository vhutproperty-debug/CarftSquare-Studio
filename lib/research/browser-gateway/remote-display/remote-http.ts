import fs from 'fs';
import http from 'http';
import path from 'path';
import type { Duplex } from 'stream';
import { auditRemote } from '@/lib/research/browser-gateway/remote-display/audit';
import { getRemoteSessionByViewId } from '@/lib/research/browser-gateway/remote-display/registry';
import { verifyRemoteViewToken } from '@/lib/research/browser-gateway/remote-display/signed-url';

const NOVNC_ROOTS = ['/usr/share/novnc', '/usr/share/novnc/web', '/usr/share/webapps/novnc'];

function resolveNovncFile(rel: string): string | null {
  const clean = rel.replace(/^\/+/, '').replace(/\.\./g, '');
  for (const root of NOVNC_ROOTS) {
    const full = path.join(root, clean || 'vnc.html');
    if (fs.existsSync(full) && fs.statSync(full).isFile()) return full;
  }
  return null;
}

function contentType(filePath: string): string {
  if (filePath.endsWith('.html')) return 'text/html; charset=utf-8';
  if (filePath.endsWith('.js')) return 'application/javascript; charset=utf-8';
  if (filePath.endsWith('.css')) return 'text/css; charset=utf-8';
  if (filePath.endsWith('.png')) return 'image/png';
  if (filePath.endsWith('.svg')) return 'image/svg+xml';
  if (filePath.endsWith('.woff') || filePath.endsWith('.woff2')) return 'font/woff2';
  return 'application/octet-stream';
}

function unauthorized(res: http.ServerResponse, reason: string) {
  res.writeHead(401, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(JSON.stringify({ error: 'Unauthorized remote view', reason }));
}

function authorizeView(
  viewId: string,
  token: string | null,
): { ok: true } | { ok: false; reason: string } {
  const session = getRemoteSessionByViewId(viewId);
  if (!session || session.destroyed) return { ok: false, reason: 'unknown_session' };
  if (Date.now() > new Date(session.expiresAt).getTime()) {
    return { ok: false, reason: 'expired' };
  }
  if (!token) return { ok: false, reason: 'missing_token' };
  const verified = verifyRemoteViewToken(token, viewId);
  if (verified.ok === false) return { ok: false, reason: verified.reason };
  if (verified.payload.c !== session.connectSessionId) {
    return { ok: false, reason: 'session_mismatch' };
  }
  return { ok: true };
}

/**
 * Handle /remote/:viewId/* HTTP requests (noVNC static + reverse proxy to websockify).
 * Returns true if the request was consumed.
 */
export function handleRemoteHttp(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  url: URL,
): boolean {
  const match = url.pathname.match(/^\/remote\/([a-f0-9]+)(?:\/(.*))?$/i);
  if (!match) return false;

  const viewId = match[1];
  const rest = match[2] || 'vnc.html';
  const token =
    url.searchParams.get('t') || extractTokenFromCookie(req, viewId) || null;

  // Generic noVNC library assets (app/, core/, vendor/) carry no session data.
  // Embedded iframes lose the auth cookie under third-party cookie blocking and
  // the browser fetches assets without the signed token → 401 → blank window.
  // Serve them for any live (non-destroyed, unexpired) view without a token.
  const isStaticAsset =
    rest !== 'websockify' &&
    !rest.endsWith('.html') &&
    /^(app|core|vendor)\//.test(rest);
  const liveSession = getRemoteSessionByViewId(viewId);
  const sessionAlive =
    Boolean(liveSession) &&
    !liveSession!.destroyed &&
    Date.now() <= new Date(liveSession!.expiresAt).getTime();

  if (!(isStaticAsset && sessionAlive)) {
    // vnc.html + websockify + anything non-static requires the signed token (or cookie).
    const auth = authorizeView(viewId, token);
    if (auth.ok === false) {
      auditRemote('remote_http_denied', { viewId, rest, reason: auth.reason }, 'warn');
      unauthorized(res, auth.reason);
      return true;
    }
  }

  const session = getRemoteSessionByViewId(viewId)!;

  if (token) {
    // SameSite=None + Partitioned (CHIPS): embedded iframes get a partitioned
    // cookie that survives third-party cookie blocking in modern Chrome.
    // Token remains required on first HTML load; cookie is HttpOnly.
    const cookieBase = `rb_view_${viewId}=${encodeURIComponent(token)}; Path=/remote/${viewId}; HttpOnly; SameSite=None; Secure; Max-Age=900`;
    res.setHeader('Set-Cookie', [cookieBase, `${cookieBase}; Partitioned`]);
  }

  if (rest === 'websockify') {
    // HTTP GET to websockify endpoint — proxy (WS upgrade handled separately).
    proxyToWebsockify(req, res, session.websockifyPort, '/');
    return true;
  }

  // Prefer proxying static files from websockify --web when available; else local novnc.
  if (rest === 'vnc.html' || rest.endsWith('.html') || rest.endsWith('.js') || rest.endsWith('.css') || rest.includes('/')) {
    let fileRel = rest === '' ? 'vnc.html' : rest;
    if (fileRel === 'vnc.html' && !resolveNovncFile('vnc.html') && resolveNovncFile('vnc_lite.html')) {
      fileRel = 'vnc_lite.html';
    }
    const local = resolveNovncFile(fileRel);
    if (local) {
      const body = fs.readFileSync(local);
      res.writeHead(200, {
        'Content-Type': contentType(local),
        'Cache-Control': 'no-store',
        // Prefer CSP frame-ancestors over X-Frame-Options so CraftSquare UI can
        // embed the live view. SAMEORIGIN blocked in-app iframe → operators only
        // got a popup button that browsers often suppress.
        'Content-Security-Policy':
          "frame-ancestors 'self' https://craftsquare.co.in https://*.craftsquare.co.in https://*.vercel.app http://localhost:3000 http://127.0.0.1:3000",
      });
      res.end(body);
      auditRemote('remote_http_static', { viewId, rest: fileRel });
      return true;
    }
    proxyToWebsockify(req, res, session.websockifyPort, `/${rest}${url.search}`);
    return true;
  }

  res.writeHead(404);
  res.end('Not found');
  return true;
}

/**
 * Handle WebSocket upgrade for /remote/:viewId/websockify
 */
export function handleRemoteUpgrade(
  req: http.IncomingMessage,
  socket: Duplex,
  head: Buffer,
): boolean {
  const host = req.headers.host || '127.0.0.1';
  const url = new URL(req.url || '/', `http://${host}`);
  const match = url.pathname.match(/^\/remote\/([a-f0-9]+)\/websockify\/?$/i);
  if (!match) return false;

  const viewId = match[1];
  const token =
    url.searchParams.get('t') || extractTokenFromCookie(req, viewId) || null;
  const auth = authorizeView(viewId, token);
  if (auth.ok === false) {
    socket.write('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n');
    socket.destroy();
    auditRemote('remote_ws_denied', { viewId, reason: auth.reason }, 'warn');
    return true;
  }

  const session = getRemoteSessionByViewId(viewId)!;
  auditRemote('remote_ws_upgrade', { viewId, port: session.websockifyPort });

  const upstream = http.request({
    hostname: '127.0.0.1',
    port: session.websockifyPort,
    path: '/websockify',
    method: req.method,
    headers: {
      ...req.headers,
      host: `127.0.0.1:${session.websockifyPort}`,
    },
  });

  upstream.on('upgrade', (upRes, upSocket, upHead) => {
    socket.write(
      `HTTP/1.1 101 Switching Protocols\r\n${Object.entries(upRes.headers)
        .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
        .join('\r\n')}\r\n\r\n`,
    );
    if (upHead?.length) socket.write(upHead);
    upSocket.pipe(socket);
    socket.pipe(upSocket);
  });

  upstream.on('error', (err) => {
    auditRemote('remote_ws_error', { viewId, error: err.message }, 'error');
    try {
      socket.write('HTTP/1.1 502 Bad Gateway\r\nConnection: close\r\n\r\n');
    } catch {
      /* ignore */
    }
    socket.destroy();
  });

  upstream.end(head);
  return true;
}

function extractTokenFromCookie(req: http.IncomingMessage, viewId: string): string | null {
  const cookie = req.headers.cookie || '';
  const re = new RegExp(`(?:^|;\\s*)rb_view_${viewId}=([^;]+)`, 'i');
  const match = cookie.match(re);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

function proxyToWebsockify(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  port: number,
  upstreamPath: string,
) {
  const upstream = http.request(
    {
      hostname: '127.0.0.1',
      port,
      path: upstreamPath,
      method: req.method,
      headers: { ...req.headers, host: `127.0.0.1:${port}` },
    },
    (up) => {
      res.writeHead(up.statusCode || 502, up.headers);
      up.pipe(res);
    },
  );
  upstream.on('error', (err) => {
    if (!res.headersSent) {
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Remote view upstream unavailable', detail: err.message }));
    }
  });
  req.pipe(upstream);
}
