/**
 * Railway edge proxy for the Browser Worker.
 * Binds process.env.PORT immediately so /health passes while tsx/Playwright warm up.
 * Forwards other traffic to the internal worker on 127.0.0.1:WORKER_PORT.
 */
import http from 'node:http';

const listenPort = Number(process.env.PORT || 8080);
const workerPort = Number(process.env.RESEARCH_BROWSER_WORKER_PORT || 4173);
const workerHost = '127.0.0.1';

function send(res, status, body) {
  const payload = typeof body === 'string' ? body : JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  });
  res.end(payload);
}

function proxy(req, res) {
  const upstream = http.request(
    {
      hostname: workerHost,
      port: workerPort,
      path: req.url,
      method: req.method,
      headers: { ...req.headers, host: `${workerHost}:${workerPort}` },
      timeout: 30_000,
    },
    (up) => {
      res.writeHead(up.statusCode || 502, up.headers);
      up.pipe(res);
    },
  );
  upstream.on('timeout', () => {
    upstream.destroy();
    if (!res.headersSent) send(res, 504, { error: 'Worker upstream timeout' });
  });
  upstream.on('error', (err) => {
    if (!res.headersSent) {
      send(res, 503, {
        ok: false,
        online: false,
        error: 'Worker upstream unavailable',
        detail: err.message,
      });
    }
  });
  req.pipe(upstream);
}

const server = http.createServer((req, res) => {
  const path = (req.url || '/').split('?')[0];
  if (req.method === 'GET' && path === '/health') {
    // Always 200 so Railway healthcheck is not blocked by Playwright warmup.
    send(res, 200, {
      ok: true,
      online: true,
      proxy: true,
      workerPort,
      at: new Date().toISOString(),
    });
    return;
  }
  proxy(req, res);
});

server.listen(listenPort, '0.0.0.0', () => {
  console.log(`[proxy] listening 0.0.0.0:${listenPort} → ${workerHost}:${workerPort}`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
  });
}
