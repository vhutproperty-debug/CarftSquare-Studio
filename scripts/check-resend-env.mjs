/**
 * Validate Resend env configuration (local or CI).
 * Usage: node scripts/check-resend-env.mjs
 */
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

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

loadEnv();

const missing = [];
if (!process.env.RESEND_API_KEY?.trim()) missing.push('RESEND_API_KEY');
if (!process.env.EMAIL_FROM?.trim()) missing.push('EMAIL_FROM');

const report = {
  ok: missing.length === 0,
  missing,
  runtime: process.env.VERCEL_ENV || process.env.NODE_ENV || 'local',
};

console.log(JSON.stringify(report, null, 2));

if (!report.ok) {
  console.error(`FAIL: Missing ${missing.join(', ')}`);
  process.exit(1);
}

console.log('PASS: Resend email configuration');
