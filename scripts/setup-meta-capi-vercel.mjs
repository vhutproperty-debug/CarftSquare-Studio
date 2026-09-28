#!/usr/bin/env node
/**
 * Set META_PIXEL_ID + META_ACCESS_TOKEN on Vercel Production and redeploy.
 * Usage: node scripts/setup-meta-capi-vercel.mjs <access_token>
 *
 * Never commit your token. Pass it as a CLI argument only.
 */
import { spawnSync } from 'child_process';

const CURRENT_PIXEL_ID = '1391594993119180';
const token = process.argv[2]?.trim();

if (!token || token.length < 20) {
  console.error('\nUsage: node scripts/setup-meta-capi-vercel.mjs <META_ACCESS_TOKEN>\n');
  console.error('Generate token from Meta Events Manager → Dataset 1391594993119180 → Settings → Generate access token.\n');
  process.exit(1);
}

function run(cmd, args, input) {
  const result = spawnSync(cmd, args, {
    input,
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
    shell: process.platform === 'win32',
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  return result.status ?? 1;
}

console.log(`\nEnsuring META_PIXEL_ID=${CURRENT_PIXEL_ID} on Vercel Production…\n`);
run('npx', ['vercel', 'env', 'rm', 'META_PIXEL_ID', 'production', '--yes'], null);
const pixelStatus = run(
  'npx',
  ['vercel', 'env', 'add', 'META_PIXEL_ID', 'production'],
  `${CURRENT_PIXEL_ID}\n`,
);
if (pixelStatus !== 0) {
  console.error('\nFailed to set META_PIXEL_ID. Set it manually in Vercel → Settings → Environment Variables.\n');
}

console.log('\nAdding META_ACCESS_TOKEN to Vercel Production…\n');
run('npx', ['vercel', 'env', 'rm', 'META_ACCESS_TOKEN', 'production', '--yes'], null);
const addStatus = run('npx', ['vercel', 'env', 'add', 'META_ACCESS_TOKEN', 'production'], `${token}\n`);
if (addStatus !== 0) {
  console.error('\nFailed to add META_ACCESS_TOKEN.\n');
  process.exit(addStatus);
}

console.log('\nRedeploying production…\n');
const deployStatus = run('npx', ['vercel', 'deploy', '--prod', '--yes'], null);
if (deployStatus !== 0) {
  console.error('\nDeploy failed. Token was saved — retry: npx vercel deploy --prod --yes\n');
  process.exit(deployStatus);
}

console.log('\nRunning verification…\n');
const verifyStatus = run('node', ['scripts/verify-meta-capi.mjs'], null);
process.exit(verifyStatus);
