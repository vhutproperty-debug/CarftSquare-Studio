/**
 * Headed login helper for Prop/Research portal sessions.
 *
 * Usage:
 *   npx tsx scripts/research-portal-login.ts --portal=housing
 *   npx tsx scripts/research-portal-login.ts --portal=magicbricks --workspace=workspace-default
 *
 * Log in in the opened browser window, then press Enter in this terminal.
 * Cookies/storage are written into the persistent profile for Capture API.
 */
import { chromium } from 'playwright';
import path from 'path';
import readline from 'readline';
import { RESEARCH_PORTALS } from '../lib/research/browser/config';

function arg(name: string, fallback?: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  if (!hit) return fallback;
  return hit.slice(name.length + 3);
}

async function main() {
  const portal = arg('portal', 'housing')!;
  const workspaceId = arg('workspace', 'workspace-default')!;
  const meta = RESEARCH_PORTALS.find((p) => p.key === portal);
  if (!meta) {
    console.error(`Unknown portal: ${portal}`);
    console.error(`Supported: ${RESEARCH_PORTALS.map((p) => p.key).join(', ')}`);
    process.exit(1);
  }

  const profileDir = path.join(process.cwd(), '.research-profiles', workspaceId, portal);
  console.log(`Opening headed Chromium for ${meta.displayName}`);
  console.log(`Profile: ${profileDir}`);
  console.log(`Login URL: ${meta.loginUrl}`);

  const context = await chromium.launchPersistentContext(profileDir, {
    headless: false,
    viewport: { width: 1365, height: 900 },
  });
  const page = context.pages()[0] || (await context.newPage());
  await page.goto(meta.loginUrl, { waitUntil: 'domcontentloaded' });

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  await new Promise<void>((resolve) => {
    rl.question('\nAfter you finish logging in, press Enter to save the profile and exit… ', () => {
      rl.close();
      resolve();
    });
  });

  await context.storageState({ path: path.join(profileDir, 'storage-state.json') }).catch(() => undefined);
  await context.close();
  console.log('Profile saved. In Prop/Research → Connectors, click Capture then Validate.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
