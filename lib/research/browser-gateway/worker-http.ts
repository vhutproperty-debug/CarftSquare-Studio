import http from 'http';
import {
  buildWorkerStatusPayload,
  getWorkerLogs,
  getWorkerState,
  pushWorkerLog,
  touchWorkerHeartbeat,
} from '@/lib/research/browser-gateway/worker-state';

export type WorkerHttpServer = {
  port: number;
  close: () => Promise<void>;
};

/**
 * Lightweight HTTP control plane for the local Browser Worker.
 * Next.js talks to this — Playwright stays in the worker process only.
 */
export async function startWorkerHttpServer(input: {
  port: number;
  getQueueStats: () => Promise<{ queueSize: number; activeSessions: number }>;
}): Promise<WorkerHttpServer> {
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url || '/', `http://127.0.0.1:${input.port}`);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-research-worker-secret');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    try {
      if (url.pathname === '/health' && req.method === 'GET') {
        const state = getWorkerState();
        json(res, 200, {
          ok: Boolean(state?.healthy),
          online: true,
          provider: state?.provider,
          port: input.port,
          lastHeartbeatAt: state?.lastHeartbeatAt,
        });
        return;
      }

      if (url.pathname === '/status' && req.method === 'GET') {
        touchWorkerHeartbeat();
        const stats = await input.getQueueStats();
        json(res, 200, buildWorkerStatusPayload(stats));
        return;
      }

      if (url.pathname === '/heartbeat' && (req.method === 'GET' || req.method === 'POST')) {
        touchWorkerHeartbeat();
        json(res, 200, {
          ok: true,
          at: new Date().toISOString(),
          workerId: getWorkerState()?.workerId,
        });
        return;
      }

      if (url.pathname === '/logs' && req.method === 'GET') {
        const limit = Math.min(Number(url.searchParams.get('limit') || 80), 200);
        json(res, 200, { ok: true, logs: getWorkerLogs(limit) });
        return;
      }

      json(res, 404, { error: 'Not found' });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      pushWorkerLog('error', `HTTP handler failed: ${message}`);
      json(res, 500, { error: message });
    }
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(input.port, '127.0.0.1', () => resolve());
  });

  pushWorkerLog('info', `HTTP control plane listening on http://127.0.0.1:${input.port}`);

  return {
    port: input.port,
    close: () =>
      new Promise((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      }),
  };
}

function json(res: http.ServerResponse, status: number, body: unknown) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
  });
  res.end(payload);
}
