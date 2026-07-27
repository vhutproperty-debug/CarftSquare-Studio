/**
 * Prop/Research Browser Worker — local control plane + Chromium execution.
 *
 * Runs OUTSIDE Next.js. Starts an HTTP health server, then claims connect
 * sessions and launches Chromium via provider adapters.
 *
 * Usage:
 *   npm run research:browser-worker
 *   npx tsx scripts/research-browser-worker.ts --once
 *   npx tsx scripts/research-browser-worker.ts --port=4173 --interval=3
 */
import { hostname } from 'os';
import { loadEnvLocal } from './lib/load-env-local.mjs';
import { resolveBrowserProvider } from '../lib/research/browser-gateway/adapters';
import { startWorkerHttpServer } from '../lib/research/browser-gateway/worker-http';
import {
  bumpWorkerTick,
  initWorkerState,
  pushWorkerLog,
  setWorkerError,
} from '../lib/research/browser-gateway/worker-state';
import {
  cleanupExpiredProfiles,
  processNextConnectJob,
  validateDueSessions,
} from '../lib/research/browser-gateway/worker-runtime';
import { startConnectorHealthMonitor, stopConnectorHealthMonitor } from '../connectors/common/connector-health-monitor';
import { RESEARCH_COLLECTIONS } from '../lib/research/collections';
import { DEFAULT_RESEARCH_WORKSPACE } from '../lib/research/business';
import { ensureResearchIndexes, getResearchDatabase } from '../lib/research/store';

// Env must load before Mongo/crypto calls (URI is read at runtime).
loadEnvLocal();

const WORKER_VERSION = '1.0.0';

function arg(name: string, fallback?: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  if (!hit) return fallback;
  return hit.slice(name.length + 3);
}

async function getQueueStats() {
  try {
    const db = await getResearchDatabase();
    await ensureResearchIndexes(db);
    const [queueSize, activeSessions] = await Promise.all([
      db.collection(RESEARCH_COLLECTIONS.connectSessions).countDocuments({ phase: 'queued' }),
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
  } catch {
    return { queueSize: 0, activeSessions: 0 };
  }
}

async function validateConfig(provider: string) {
  if (!process.env.AUTH_SECRET && !process.env.NEXTAUTH_SECRET && !process.env.RESEARCH_ENCRYPTION_KEY) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'AUTH_SECRET (or RESEARCH_ENCRYPTION_KEY) is required to encrypt portal sessions.',
      );
    }
    pushWorkerLog(
      'warn',
      'AUTH_SECRET not set — using development encryption key. Set AUTH_SECRET before production.',
    );
  }

  if (provider === 'browserless' && !process.env.RESEARCH_BROWSERLESS_WS) {
    throw new Error('RESEARCH_BROWSER_PROVIDER=browserless requires RESEARCH_BROWSERLESS_WS.');
  }
  if (provider === 'browserbase' && !process.env.RESEARCH_BROWSERBASE_WS) {
    throw new Error('RESEARCH_BROWSER_PROVIDER=browserbase requires RESEARCH_BROWSERBASE_WS.');
  }

  // Self-hosted / Docker: Chromium must already be on disk (image build + entrypoint check).
  if (provider === 'self_hosted' || provider === 'docker_worker') {
    const { chromium } = await import('playwright');
    const fs = await import('fs');
    const executablePath = chromium.executablePath();
    const exists = Boolean(executablePath) && fs.existsSync(executablePath);
    pushWorkerLog(
      'info',
      `playwright_chromium executablePath=${executablePath} browserExists=${exists} PLAYWRIGHT_BROWSERS_PATH=${process.env.PLAYWRIGHT_BROWSERS_PATH || 'default'}`,
    );
    if (!exists) {
      throw new Error(
        `Playwright Chromium executable missing at ${executablePath || '(empty)'}. ` +
          'Rebuild Railway with Dockerfile.browser-worker (npx playwright install --with-deps chromium).',
      );
    }
  }

  // Verify Mongo connectivity early
  const db = await getResearchDatabase();
  await ensureResearchIndexes(db);
  await db.command({ ping: 1 });
  pushWorkerLog('info', 'MongoDB connectivity OK');
}

async function tick() {
  bumpWorkerTick();
  try {
    const processed = await processNextConnectJob();
    const validated = await validateDueSessions(DEFAULT_RESEARCH_WORKSPACE.id);
    const cleaned = await cleanupExpiredProfiles();
    setWorkerError(null);
    pushWorkerLog(
      'info',
      `tick complete · connectJob=${processed} validated=${validated} cleanedPreviews=${cleaned}`,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    setWorkerError(message);
    pushWorkerLog('error', `tick failed: ${message}`);
  }
}

function resolveListenPort(): number {
  // Prefer explicit worker port (Railway proxy mode sets RESEARCH_BROWSER_WORKER_PORT=4173
  // while PORT stays on the edge proxy). Fall back to Railway PORT, then local default.
  const raw = arg(
    'port',
    process.env.RESEARCH_BROWSER_WORKER_PORT || process.env.PORT || '4173',
  );
  const port = Number(raw);
  if (!Number.isFinite(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid worker port: ${raw}`);
  }
  return port;
}

function resolveListenHost(): string {
  // Explicit override wins (Railway proxy mode uses 127.0.0.1 behind the edge proxy).
  const explicit = process.env.RESEARCH_BROWSER_WORKER_HOST?.trim();
  if (explicit) return explicit;
  if (process.env.PORT || process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_SERVICE_ID) {
    return '0.0.0.0';
  }
  return '127.0.0.1';
}

async function main() {
  const once = process.argv.includes('--once');
  const port = resolveListenPort();
  const host = resolveListenHost();
  const intervalSec = Math.max(2, Number(arg('interval', '3')));
  const provider = resolveBrowserProvider();
  const workerId = `browser-${hostname()}-${process.pid}`;

  console.log('');
  console.log('══════════════════════════════════════════════════════════');
  console.log(' Prop/Research Browser Worker');
  console.log('══════════════════════════════════════════════════════════');
  console.log(` version     : ${WORKER_VERSION}`);
  console.log(` workerId    : ${workerId}`);
  console.log(` provider    : ${provider}`);
  console.log(` listen port : ${port}`);
  console.log(` bind        : ${host}`);
  console.log(` interval    : ${intervalSec}s`);
  {
    const { getWorkerPublicBaseUrl } = await import(
      '../lib/research/browser-gateway/remote-display/signed-url'
    );
    const publicBase = getWorkerPublicBaseUrl();
    const source = process.env.RESEARCH_BROWSER_WORKER_PUBLIC_URL?.trim()
      ? 'RESEARCH_BROWSER_WORKER_PUBLIC_URL'
      : process.env.RAILWAY_PUBLIC_DOMAIN?.trim()
        ? 'RAILWAY_PUBLIC_DOMAIN'
        : 'localhost_fallback';
    console.log(` publicBase  : ${publicBase}`);
    console.log(` publicSrc   : ${source}`);
    if (source === 'localhost_fallback' && (process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_SERVICE_ID)) {
      console.warn(
        '[research-browser-worker] WARNING: liveViewUrl will use 127.0.0.1 — set RESEARCH_BROWSER_WORKER_PUBLIC_URL to the Railway public HTTPS URL',
      );
    }
    pushWorkerLog('info', `live_view_public_base url=${publicBase} source=${source}`);
  }
  console.log('══════════════════════════════════════════════════════════');
  console.log('');

  initWorkerState({ workerId, provider, port });

  // Bind HTTP before Mongo/config so Railway /health can pass while deps warm up.
  let httpServer: Awaited<ReturnType<typeof startWorkerHttpServer>> | null = null;
  let stopping = false;
  try {
    httpServer = await startWorkerHttpServer({
      host,
      port,
      getQueueStats,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(
      `[research-browser-worker] FAILED to bind ${host}:${port}: ${message}\n` +
        `Is another worker already running? Try --port=${port + 1}`,
    );
    process.exit(1);
  }

  if (host === '0.0.0.0') {
    pushWorkerLog('info', `HTTP listening · bound 0.0.0.0:${port} · GET /health`);
    pushWorkerLog(
      'info',
      'Set Vercel RESEARCH_BROWSER_WORKER_URL to this service public HTTPS URL',
    );
  } else if (process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_SERVICE_ID) {
    pushWorkerLog('info', `HTTP listening · ${host}:${port} (behind Railway edge proxy)`);
    pushWorkerLog(
      'info',
      'Set Vercel RESEARCH_BROWSER_WORKER_URL to this service public HTTPS URL (not 127.0.0.1)',
    );
  } else {
    pushWorkerLog('info', `HTTP listening · http://127.0.0.1:${port}/status`);
    pushWorkerLog(
      'info',
      `Next.js should use RESEARCH_BROWSER_WORKER_URL=http://127.0.0.1:${port}`,
    );
  }

  // Retry config/Mongo so a missing secret or brief Atlas blip does not leave PORT unbound.
  for (let attempt = 1; ; attempt += 1) {
    if (stopping) break;
    try {
      await validateConfig(provider);
      setWorkerError(null);
      startConnectorHealthMonitor();
      pushWorkerLog('info', 'Ready to claim connect sessions. Playwright will only run in this process.');
      break;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setWorkerError(message);
      console.error(`[research-browser-worker] CONFIG ERROR (attempt ${attempt}): ${message}`);
      pushWorkerLog('error', `CONFIG ERROR (attempt ${attempt}): ${message}`);
      if (once) process.exit(1);
      await new Promise((r) => setTimeout(r, Math.min(30_000, 2_000 * attempt)));
    }
  }

  const shutdown = async (signal: string) => {
    if (stopping) return;
    stopping = true;
    pushWorkerLog('warn', `Shutting down (${signal})…`);
    stopConnectorHealthMonitor();
    try {
      await httpServer?.close();
    } catch {
      /* ignore */
    }
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));

  if (once) {
    await tick();
    try {
      await Promise.race([
        httpServer.close(),
        new Promise((resolve) => setTimeout(resolve, 2_000)),
      ]);
    } catch {
      /* ignore */
    }
    process.exit(0);
  }

  for (;;) {
    if (stopping) break;
    await tick();
    if (stopping) break;
    await new Promise((r) => setTimeout(r, intervalSec * 1000));
  }
}

main().catch((err) => {
  console.error('[research-browser-worker] FATAL', err);
  process.exit(1);
});
