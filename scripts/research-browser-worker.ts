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

async function main() {
  const once = process.argv.includes('--once');
  const port = Math.max(1024, Number(arg('port', process.env.RESEARCH_BROWSER_WORKER_PORT || '4173')));
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
  console.log(` bind        : 127.0.0.1 (local PC — Railway URL later)`);
  console.log(` interval    : ${intervalSec}s`);
  console.log('══════════════════════════════════════════════════════════');
  console.log('');

  initWorkerState({ workerId, provider, port });

  try {
    await validateConfig(provider);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[research-browser-worker] CONFIG ERROR: ${message}`);
    process.exit(1);
  }

  let httpServer: Awaited<ReturnType<typeof startWorkerHttpServer>> | null = null;
  try {
    httpServer = await startWorkerHttpServer({
      port,
      getQueueStats,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(
      `[research-browser-worker] FAILED to bind port ${port}: ${message}\n` +
        `Is another worker already running? Try --port=${port + 1}`,
    );
    process.exit(1);
  }

  pushWorkerLog('info', `Worker healthy · http://127.0.0.1:${port}/status`);
  pushWorkerLog('info', 'Next.js should use RESEARCH_BROWSER_WORKER_URL=http://127.0.0.1:' + port);
  pushWorkerLog('info', 'Ready to claim connect sessions. Playwright will only run in this process.');

  const shutdown = async (signal: string) => {
    pushWorkerLog('warn', `Shutting down (${signal})…`);
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
    await tick();
    await new Promise((r) => setTimeout(r, intervalSec * 1000));
  }
}

main().catch((err) => {
  console.error('[research-browser-worker] FATAL', err);
  process.exit(1);
});
