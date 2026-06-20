#!/usr/bin/env node
/**
 * Add META_ACCESS_TOKEN to Vercel Production and redeploy.
 * Usage: node scripts/setup-meta-capi-vercel.mjs <access_token>
 *
 * Never commit your token. Pass it as a CLI argument only.
 */
import { spawnSync } from 'child_process';

const token = process.argv[2]?.trim();

if (!token || token.length < 20) {
  console.error('\nUsage: node scripts/setup-meta-capi-vercel.mjs <META_ACCESS_TOKEN>\n');
  console.error('Get your token from Meta Events Manager (see README in audit output).');
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

console.log('\nAdding META_ACCESS_TOKEN to Vercel Production…\n');
const addStatus = run('npx', ['vercel', 'env', 'add', 'META_ACCESS_TOKEN', 'production'], `${token}\n`);
if (addStatus !== 0) {
  console.error('\nFailed to add env var. If it already exists, run:');
  console.error('  npx vercel env rm META_ACCESS_TOKEN production');
  console.error('  node scripts/setup-meta-capi-vercel.mjs <token>\n');
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
