/**
 * Prop/Research Browser Worker — remote connect + session maintenance.
 *
 * Runs OUTSIDE Next.js. Claims connect sessions, launches browsers via adapters,
 * captures encrypted cookies, validates, and periodically re-validates sessions.
 *
 * Usage:
 *   npm run research:browser-worker
 *   npx tsx scripts/research-browser-worker.ts --once
 *   npx tsx scripts/research-browser-worker.ts --interval=3
 */
import {
  cleanupExpiredProfiles,
  processNextConnectJob,
  validateDueSessions,
} from '../lib/research/browser-gateway/worker-runtime';
import { DEFAULT_RESEARCH_WORKSPACE } from '../lib/research/business';

function arg(name: string, fallback?: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  if (!hit) return fallback;
  return hit.slice(name.length + 3);
}

async function tick() {
  const processed = await processNextConnectJob();
  const validated = await validateDueSessions(DEFAULT_RESEARCH_WORKSPACE.id);
  const cleaned = await cleanupExpiredProfiles();
  console.log(
    `[research-browser-worker] connectJob=${processed} validated=${validated} cleanedPreviews=${cleaned}`,
  );
}

async function main() {
  const once = process.argv.includes('--once');
  const intervalSec = Math.max(2, Number(arg('interval', '3')));

  if (once) {
    await tick();
    return;
  }

  console.log(`[research-browser-worker] loop every ${intervalSec}s (provider=${process.env.RESEARCH_BROWSER_PROVIDER || 'self_hosted'})`);
  for (;;) {
    try {
      await tick();
    } catch (error) {
      console.error('[research-browser-worker] tick failed', error);
    }
    await new Promise((r) => setTimeout(r, intervalSec * 1000));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
