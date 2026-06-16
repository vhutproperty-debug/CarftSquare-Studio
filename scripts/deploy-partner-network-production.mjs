/**
 * Partner Network production deploy preflight.
 * Runs build + partner test suite. Exits non-zero on failure (blocks deploy).
 * Usage: node scripts/deploy-partner-network-production.mjs [baseUrl]
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const BASE = process.argv[2] || 'http://localhost:3000';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function loadEnv() {
  for (const name of ['.env.local', '.env']) {
    const p = join(root, name);
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, 'utf8').split('\n')) {
      const m = line.match(/^([^#=]+)=(.*)$/);
      if (m && !process.env[m[1].trim()]) {
        process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '');
      }
    }
  }
}

function run(label, command, args, opts = {}) {
  console.log(`\n>>> ${label}`);
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: 'inherit',
    shell: true,
    ...opts,
  });
  if (result.status !== 0) {
    console.error(`FAIL: ${label}`);
    process.exit(result.status || 1);
  }
  console.log(`PASS: ${label}`);
}

loadEnv();

const requiredForOtp = ['RESEND_API_KEY'];
const requiredCore = ['MONGODB_URI', 'AUTH_SECRET'];
const missingCore = requiredCore.filter((key) => !process.env[key] && !(key === 'MONGODB_URI' && process.env.DATABASE_URL));
const missingOtp = requiredForOtp.filter((key) => !process.env[key]);

console.log('--- Environment preflight ---');
console.log(JSON.stringify({
  MONGODB_URI: Boolean(process.env.MONGODB_URI || process.env.DATABASE_URL),
  AUTH_SECRET: Boolean(process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET),
  RESEND_API_KEY: Boolean(process.env.RESEND_API_KEY),
  EMAIL_FROM: process.env.EMAIL_FROM || 'CraftSquare Studio <notifications@craftsquare.co.in> (default)',
  NEXTAUTH_URL: process.env.NEXTAUTH_URL || '(set on host)',
  missingCore,
  missingOtp,
}, null, 2));

if (missingCore.length) {
  console.error('FAIL: Missing core environment variables for production.');
  process.exit(1);
}

run('TypeScript check', 'npm', ['run', 'type-check']);
run('ESLint', 'npm', ['run', 'lint']);
run('Production build', 'npm', ['run', 'build']);

const tests = [
  ['verify-partner-network.mjs', 'Site + partner smoke'],
  ['test-partner-registration-approval-flow.mjs', 'Registration → approval E2E'],
  ['test-partner-auth-flow.mjs', 'Unified auth flow'],
  ['test-partner-approval-login.mjs', 'Approval + login'],
  ['test-partner-otp-auth.mjs', 'Email OTP auth'],
];

for (const [script, label] of tests) {
  run(label, 'node', [`scripts/${script}`, BASE]);
}

console.log('\n--- Deploy preflight PASS ---');
console.log(JSON.stringify({
  build: 'PASS',
  tests: tests.length,
  otpProvider: process.env.RESEND_API_KEY ? 'resend' : 'missing',
  emailFrom: process.env.EMAIL_FROM || 'CraftSquare Studio <notifications@craftsquare.co.in>',
  readyToDeploy: true,
}, null, 2));
