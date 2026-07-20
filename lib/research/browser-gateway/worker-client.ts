import { RESEARCH_COLLECTIONS } from '@/lib/research/collections';
import { resolveBrowserProvider } from '@/lib/research/browser-gateway/adapters';
import { WORKER_HTTP_VERSION } from '@/lib/research/browser-gateway/worker-state';
import { ensureResearchIndexes, getResearchDatabase } from '@/lib/research/store';

export type BrowserWorkerStatus = {
  online: boolean;
  provider: string;
  queueSize: number;
  activeSessions: number;
  uptime: number;
  version: string;
  lastHeartbeatAt: string | null;
  lastError: string | null;
  port: number | null;
  workerId: string | null;
  healthy: boolean;
  source: 'http' | 'offline';
  /** Hostname:port from RESEARCH_BROWSER_WORKER_URL (no path/secrets). */
  workerHost: string;
  workerUrlIsLocalhost: boolean;
};

/** Default local worker URL — Railway can override with RESEARCH_BROWSER_WORKER_URL. */
export function getBrowserWorkerBaseUrl(): string {
  return (
    process.env.RESEARCH_BROWSER_WORKER_URL?.trim() ||
    `http://127.0.0.1:${process.env.RESEARCH_BROWSER_WORKER_PORT || '4173'}`
  );
}

export function describeBrowserWorkerUrl(baseUrl = getBrowserWorkerBaseUrl()): {
  workerHost: string;
  workerUrlIsLocalhost: boolean;
} {
  try {
    const u = new URL(baseUrl);
    const workerHost = u.port ? `${u.hostname}:${u.port}` : u.hostname;
    const workerUrlIsLocalhost =
      u.hostname === '127.0.0.1' ||
      u.hostname === 'localhost' ||
      u.hostname === '::1';
    return { workerHost, workerUrlIsLocalhost };
  } catch {
    return { workerHost: 'invalid', workerUrlIsLocalhost: true };
  }
}

export async function countConnectQueue(): Promise<{
  queueSize: number;
  activeSessions: number;
}> {
  const db = await getResearchDatabase();
  await ensureResearchIndexes(db);
  const [queueSize, activeSessions] = await Promise.all([
    db.collection(RESEARCH_COLLECTIONS.connectSessions).countDocuments({
      phase: 'queued',
    }),
    db.collection(RESEARCH_COLLECTIONS.connectSessions).countDocuments({
      phase: {
        $in: [
          'connecting',
          'opening_browser',
          'waiting_for_login',
          'capturing',
          'encrypting',
          'validating',
        ],
      },
    }),
  ]);
  return { queueSize, activeSessions };
}

/**
 * Probe the local (or remote) Browser Worker HTTP control plane.
 * Next.js never launches Playwright — it only checks worker health.
 */
export async function fetchBrowserWorkerStatus(): Promise<BrowserWorkerStatus> {
  const queue = await countConnectQueue().catch(() => ({ queueSize: 0, activeSessions: 0 }));
  const base = getBrowserWorkerBaseUrl();
  const urlMeta = describeBrowserWorkerUrl(base);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2_500);

  try {
    const res = await fetch(`${base}/status`, {
      method: 'GET',
      signal: controller.signal,
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
        ...(process.env.RESEARCH_BROWSER_WORKER_SECRET
          ? { 'x-research-worker-secret': process.env.RESEARCH_BROWSER_WORKER_SECRET }
          : {}),
      },
    });
    clearTimeout(timeout);
    if (!res.ok) {
      return offlineStatus(queue, `Worker HTTP ${res.status}`);
    }
    const json = (await res.json()) as Partial<BrowserWorkerStatus> & {
      online?: boolean;
    };
    return {
      online: json.online !== false,
      provider: String(json.provider || resolveBrowserProvider()),
      queueSize: Number(json.queueSize ?? queue.queueSize),
      activeSessions: Number(json.activeSessions ?? queue.activeSessions),
      uptime: Number(json.uptime || 0),
      version: String(json.version || WORKER_HTTP_VERSION),
      lastHeartbeatAt: (json.lastHeartbeatAt as string) || new Date().toISOString(),
      lastError: (json.lastError as string | null) ?? null,
      port: typeof json.port === 'number' ? json.port : null,
      workerId: (json.workerId as string | null) ?? null,
      healthy: json.healthy !== false,
      source: 'http',
      ...urlMeta,
    };
  } catch (error) {
    clearTimeout(timeout);
    const message =
      error instanceof Error
        ? error.name === 'AbortError'
          ? 'Worker status timed out'
          : error.message
        : 'Worker unreachable';
    return offlineStatus(queue, message);
  }
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchBrowserWorkerLogs(limit = 80): Promise<
  Array<{ at: string; level: string; message: string }>
> {
  const base = getBrowserWorkerBaseUrl();
  try {
    const res = await fetchWithTimeout(
      `${base}/logs?limit=${limit}`,
      { cache: 'no-store' },
      2_500,
    );
    if (!res.ok) return [];
    const json = await res.json();
    return Array.isArray(json.logs) ? json.logs : [];
  } catch {
    return [];
  }
}

/** Ping worker heartbeat endpoint (Next.js → worker, every ~10s). */
export async function pingBrowserWorkerHeartbeat(): Promise<boolean> {
  const base = getBrowserWorkerBaseUrl();
  try {
    const res = await fetchWithTimeout(
      `${base}/heartbeat`,
      { method: 'POST', cache: 'no-store' },
      2_000,
    );
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Run portal validateSession on the Browser Worker (has Chromium).
 * Next.js / Vercel must never launch Playwright locally.
 */
export async function requestWorkerValidateSession(input: {
  workspaceId: string;
  portal: string;
}): Promise<{
  ok: boolean;
  status: string;
  message?: string;
  sessionId?: string;
  httpStatus?: number | null;
  responseKind?: string;
  error?: string;
}> {
  const base = getBrowserWorkerBaseUrl();
  const worker = await fetchBrowserWorkerStatus();
  if (!worker.online || !worker.healthy) {
    return {
      ok: false,
      status: 'error',
      message:
        worker.lastError ||
        'Browser Worker is offline. Chromium validation runs only on Railway (unique-endurance).',
    };
  }

  try {
    const res = await fetchWithTimeout(
      `${base}/jobs/validate`,
      {
        method: 'POST',
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...(process.env.RESEARCH_BROWSER_WORKER_SECRET
            ? { 'x-research-worker-secret': process.env.RESEARCH_BROWSER_WORKER_SECRET }
            : {}),
        },
        body: JSON.stringify({
          workspaceId: input.workspaceId,
          portal: input.portal,
        }),
      },
      110_000,
    );
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      return {
        ok: false,
        status: 'error',
        message: String(json.error || `Worker validate HTTP ${res.status}`),
        error: String(json.error || res.statusText),
      };
    }
    return {
      ok: Boolean(json.ok),
      status: String(json.status || (json.ok ? 'valid' : 'error')),
      message: typeof json.message === 'string' ? json.message : undefined,
      sessionId: typeof json.sessionId === 'string' ? json.sessionId : undefined,
      httpStatus:
        typeof json.httpStatus === 'number' || json.httpStatus === null
          ? (json.httpStatus as number | null)
          : undefined,
      responseKind: typeof json.responseKind === 'string' ? json.responseKind : undefined,
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.name === 'AbortError'
          ? 'Worker validate timed out'
          : error.message
        : 'Worker validate failed';
    return { ok: false, status: 'error', message, error: message };
  }
}

/**
 * Run portal executeSearch on the Browser Worker (has Chromium + encrypted cookies).
 * Next.js / Vercel must never launch Playwright locally.
 */
export async function requestWorkerExecuteSearch(input: {
  workspaceId: string;
  portal: string;
  criteria: import('@/lib/research/types').ResearchPlanCriteria;
  sessionId?: string;
  skipValidation?: boolean;
}): Promise<import('@/lib/research/types').ConnectorSearchResponse> {
  const base = getBrowserWorkerBaseUrl();
  const worker = await fetchBrowserWorkerStatus();
  if (!worker.online || !worker.healthy) {
    return {
      ok: false,
      listings: [],
      sessionStatus: 'error',
      message:
        worker.lastError ||
        'Browser Worker is offline. Authenticated portal search runs only on Railway.',
    };
  }

  try {
    const res = await fetchWithTimeout(
      `${base}/jobs/search`,
      {
        method: 'POST',
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...(process.env.RESEARCH_BROWSER_WORKER_SECRET
            ? { 'x-research-worker-secret': process.env.RESEARCH_BROWSER_WORKER_SECRET }
            : {}),
        },
        body: JSON.stringify({
          workspaceId: input.workspaceId,
          portal: input.portal,
          criteria: input.criteria,
          sessionId: input.sessionId,
          skipValidation: input.skipValidation,
        }),
      },
      110_000,
    );
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      return {
        ok: false,
        listings: [],
        sessionStatus: 'error',
        message: String(json.error || `Worker search HTTP ${res.status}`),
      };
    }
    return {
      ok: Boolean(json.ok),
      listings: Array.isArray(json.listings) ? (json.listings as import('@/lib/research/types').ResearchListing[]) : [],
      sessionStatus: String(json.sessionStatus || (json.ok ? 'valid' : 'error')) as import('@/lib/research/types').ResearchBrowserSessionStatus,
      message: typeof json.message === 'string' ? json.message : undefined,
      screenshotPath: typeof json.screenshotPath === 'string' ? json.screenshotPath : undefined,
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.name === 'AbortError'
          ? 'Worker search timed out'
          : error.message
        : 'Worker search failed';
    return { ok: false, listings: [], sessionStatus: 'error', message };
  }
}

function offlineStatus(
  queue: { queueSize: number; activeSessions: number },
  lastError: string,
): BrowserWorkerStatus {
  return {
    online: false,
    provider: resolveBrowserProvider(),
    queueSize: queue.queueSize,
    activeSessions: queue.activeSessions,
    uptime: 0,
    version: WORKER_HTTP_VERSION,
    lastHeartbeatAt: null,
    lastError,
    port: Number(process.env.RESEARCH_BROWSER_WORKER_PORT || 4173),
    workerId: null,
    healthy: false,
    source: 'offline',
    ...describeBrowserWorkerUrl(),
  };
}
