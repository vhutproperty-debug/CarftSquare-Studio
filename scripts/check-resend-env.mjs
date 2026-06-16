/**
 * Validate Resend env configuration (local or CI).
 * Usage: node scripts/check-resend-env.mjs
 */
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_EMAIL_FROM = 'CraftSquare Studio <notifications@craftsquare.co.in>';

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

function readFirst(names) {
  for (const name of names) {
    const value = process.env[name]?.trim().replace(/^["']|["']$/g, '');
    if (value) return { value, source: name };
  }
  return { value: '', source: null };
}

loadEnv();

const apiKey = readFirst(['RESEND_API_KEY', 'RESEND_KEY']);
const emailFrom = readFirst(['EMAIL_FROM', 'RESEND_FROM', 'RESEND_EMAIL']);
const missing = [];

if (!apiKey.value) missing.push('RESEND_API_KEY');
if (!emailFrom.value) {
  console.warn(`WARN: EMAIL_FROM not set — production uses default ${DEFAULT_EMAIL_FROM}`);
}

const report = {
  ok: missing.length === 0,
  missing,
  apiKeySource: apiKey.source,
  emailFromSource: emailFrom.source || 'default',
  runtime: process.env.VERCEL_ENV || process.env.NODE_ENV || 'local',
};

console.log(JSON.stringify(report, null, 2));

if (!report.ok) {
  console.error(`FAIL: Missing ${missing.join(', ')}`);
  process.exit(1);
}

console.log('PASS: Resend email configuration');
