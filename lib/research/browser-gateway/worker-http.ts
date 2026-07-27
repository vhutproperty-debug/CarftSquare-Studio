import http from 'http';
import {
  handleRemoteHttp,
  handleRemoteUpgrade,
} from '@/lib/research/browser-gateway/remote-display/remote-http';
import {
  buildWorkerStatusPayload,
  getWorkerLogs,
  getWorkerState,
  pushWorkerLog,
  touchWorkerHeartbeat,
} from '@/lib/research/browser-gateway/worker-state';

export type WorkerHttpServer = {
  host: string;
  port: number;
  close: () => Promise<void>;
};

/**
 * Lightweight HTTP control plane for the Browser Worker.
 * Next.js talks to this — Playwright stays in the worker process only.
 * Also serves signed noVNC remote-view routes under /remote/:viewId/*.
 */
export async function startWorkerHttpServer(input: {
  host?: string;
  port: number;
  getQueueStats: () => Promise<{ queueSize: number; activeSessions: number }>;
}): Promise<WorkerHttpServer> {
  const host = input.host || '127.0.0.1';
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url || '/', `http://${host}:${input.port}`);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-research-worker-secret');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    try {
      if (handleRemoteHttp(req, res, url)) return;

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
        let metrics: unknown = null;
        try {
          const { getProductionMetrics } = await import('@/lib/research/ops/metrics');
          metrics = getProductionMetrics();
        } catch {
          /* metrics optional */
        }
        json(res, 200, buildWorkerStatusPayload({ ...stats, metrics }));
        return;
      }

      if (url.pathname === '/metrics' && req.method === 'GET') {
        touchWorkerHeartbeat();
        const { getProductionMetrics, RESEARCH_PROTOCOL_VERSION } = await import(
          '@/lib/research/ops/metrics'
        );
        json(res, 200, {
          ok: true,
          protocolVersion: RESEARCH_PROTOCOL_VERSION,
          metrics: getProductionMetrics(),
        });
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

      // Sync validate on the worker (Chromium lives here — never on Vercel).
      if (url.pathname === '/jobs/validate' && req.method === 'POST') {
        if (!authorizeWorkerRequest(req)) {
          json(res, 401, { error: 'Unauthorized' });
          return;
        }
        const body = (await readJsonBody(req)) as {
          workspaceId?: string;
          portal?: string;
        };
        const workspaceId = String(body.workspaceId || '').trim();
        const portal = String(body.portal || '').trim();
        if (!workspaceId || !portal) {
          json(res, 400, { error: 'workspaceId and portal are required' });
          return;
        }
        const { requirePortalConnector } = await import('@/connectors/registry');
        const connector = requirePortalConnector(portal);
        pushWorkerLog(
          'info',
          `http_jobs_validate start workspaceId=${workspaceId} portal=${portal}`,
        );
        const result = await connector.validateSession(workspaceId);
        pushWorkerLog(
          result.ok ? 'info' : 'warn',
          `http_jobs_validate done workspaceId=${workspaceId} portal=${portal} ok=${result.ok} status=${result.status}`,
        );
        json(res, 200, { ok: result.ok, ...result });
        return;
      }

      // Authenticated portal search on the worker (same encrypted session as Connectors).
      if (url.pathname === '/jobs/search' && req.method === 'POST') {
        if (!authorizeWorkerRequest(req)) {
          json(res, 401, { error: 'Unauthorized' });
          return;
        }
        const body = (await readJsonBody(req)) as {
          workspaceId?: string;
          portal?: string;
          criteria?: Record<string, unknown>;
          sessionId?: string;
          skipValidation?: boolean;
        };
        const workspaceId = String(body.workspaceId || '').trim();
        const portal = String(body.portal || '').trim();
        if (!workspaceId || !portal) {
          json(res, 400, { error: 'workspaceId and portal are required' });
          return;
        }
        const { requirePortalConnector } = await import('@/connectors/registry');
        const connector = requirePortalConnector(portal);
        pushWorkerLog(
          'info',
          `http_jobs_search start workspaceId=${workspaceId} portal=${portal}`,
        );
        const result = await connector.executeSearch({
          workspaceId,
          criteria: (body.criteria || {}) as import('@/lib/research/types').ResearchPlanCriteria,
          sessionId: typeof body.sessionId === 'string' ? body.sessionId : undefined,
          skipValidation: Boolean(body.skipValidation),
        });
        pushWorkerLog(
          result.ok ? 'info' : 'warn',
          `http_jobs_search done workspaceId=${workspaceId} portal=${portal} ok=${result.ok} listings=${result.listings?.length || 0} degraded=${Boolean(result.degraded)}`,
        );
        json(res, 200, result);
        return;
      }

      // Debug inspect: load authenticated session, open search URL, report DOM signals.
      if (url.pathname === '/jobs/inspect-search' && req.method === 'POST') {
        if (!authorizeWorkerRequest(req)) {
          json(res, 401, { error: 'Unauthorized' });
          return;
        }
        const body = (await readJsonBody(req)) as {
          workspaceId?: string;
          portal?: string;
          url?: string;
        };
        const workspaceId = String(body.workspaceId || '').trim();
        const portal = String(body.portal || '').trim();
        const targetUrl = String(body.url || '').trim();
        if (!workspaceId || !portal || !targetUrl) {
          json(res, 400, { error: 'workspaceId, portal, and url are required' });
          return;
        }
        const { findBrowserSession } = await import('@/lib/research/sessions/session-store');
        const { researchBrowserManager } = await import('@/lib/research/browser/browser-manager');
        const session = await findBrowserSession(workspaceId, portal);
        if (!session?.encryptedCookies) {
          json(res, 200, {
            ok: false,
            error: 'No encrypted cookies for portal session',
            sessionStatus: session?.sessionStatus || null,
          });
          return;
        }
        pushWorkerLog('info', `http_jobs_inspect_search portal=${portal} url=${targetUrl}`);
        const outcome = await researchBrowserManager.withPage(
          session,
          `inspect-${portal}`,
          async (page) => {
            const response = await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });
            await new Promise((r) => setTimeout(r, 2_500));
            const httpStatus = response?.status() ?? null;
            const title = await page.title().catch(() => '');
            const finalUrl = page.url();
            const html = await page.content().catch(() => '');
            const signals = await page.evaluate(() => {
              const anchors = Array.from(document.querySelectorAll('a[href]'));
              const hrefs = anchors.map((a) => (a as HTMLAnchorElement).href).filter(Boolean);
              const propertyRe = /property|\/rent|\/buy|flat|apartment|resale/i;
              const property = hrefs.filter((h) => propertyRe.test(h));
              return {
                totalAnchorCount: hrefs.length,
                propertyAnchorCount: property.length,
                sampleHrefs: Array.from(new Set(property.length ? property : hrefs)).slice(0, 12),
                bodyTextSample: (document.body?.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 400),
              };
            });
            const securityChallenge = /security|challenge|access denied|captcha|akamai/i.test(
              `${title} ${signals.bodyTextSample}`,
            );
            return {
              ok: true,
              httpStatus,
              title,
              finalUrl,
              requestedUrl: targetUrl,
              htmlLength: html.length,
              securityChallenge,
              ...signals,
            };
          },
        );
        if (outcome.error) {
          json(res, 200, { ok: false, error: outcome.error.message });
          return;
        }
        json(res, 200, outcome.result);
        return;
      }

      json(res, 404, { error: 'Not found' });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      pushWorkerLog('error', `HTTP handler failed: ${message}`);
      json(res, 500, { error: message });
    }
  });

  server.on('upgrade', (req, socket, head) => {
    if (handleRemoteUpgrade(req, socket, head)) return;
    socket.destroy();
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(input.port, host, () => resolve());
  });

  pushWorkerLog('info', `HTTP control plane listening on http://${host}:${input.port}`);

  return {
    host,
    port: input.port,
    close: () =>
      new Promise((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      }),
  };
}

function authorizeWorkerRequest(req: http.IncomingMessage): boolean {
  const secret = process.env.RESEARCH_BROWSER_WORKER_SECRET?.trim();
  if (!secret) return true;
  return req.headers['x-research-worker-secret'] === secret;
}

async function readJsonBody(req: http.IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    return {};
  }
}

function json(res: http.ServerResponse, status: number, body: unknown) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
  });
  res.end(payload);
}
