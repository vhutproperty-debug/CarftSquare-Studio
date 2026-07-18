/**
 * Prop/Research Phase 5 — background monitor worker.
 *
 * Enqueues due watches and processes the priority job queue (browser crawl →
 * KG delta → alerts → trends). Run continuously or via cron.
 *
 * Usage:
 *   npx tsx scripts/research-monitor-worker.ts
 *   npx tsx scripts/research-monitor-worker.ts --once
 *   npx tsx scripts/research-monitor-worker.ts --interval=60 --process=2
 */
import { runMonitorTick } from '../lib/research/monitoring/worker';

function arg(name: string, fallback?: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  if (!hit) return fallback;
  return hit.slice(name.length + 3);
}

async function tickOnce() {
  const enqueueLimit = Number(arg('enqueue', '20'));
  const processLimit = Number(arg('process', '2'));
  const result = await runMonitorTick({ enqueueLimit, processLimit });
  console.log(
    `[research-monitor] enqueued=${result.enqueued} processed=${result.processed}`,
    result.jobs,
  );
  return result;
}

async function main() {
  const once = process.argv.includes('--once');
  const intervalSec = Math.max(15, Number(arg('interval', '60')));

  if (once) {
    await tickOnce();
    return;
  }

  console.log(`[research-monitor] starting loop every ${intervalSec}s`);
  for (;;) {
    try {
      await tickOnce();
    } catch (error) {
      console.error('[research-monitor] tick failed', error);
    }
    await new Promise((r) => setTimeout(r, intervalSec * 1000));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
