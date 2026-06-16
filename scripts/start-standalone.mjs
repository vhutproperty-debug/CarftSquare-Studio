/**
 * Start Next.js standalone production server locally.
 * - Loads .env.local from project root (required for MongoDB/API routes)
 * - Ensures .next/static is copied into the standalone output
 * - Runs node server.js from .next/standalone
 */
import { spawn } from 'child_process';
import { cpSync, existsSync, mkdirSync, readFileSync } from 'fs';
import { join, resolve } from 'path';

const root = resolve(process.cwd());
const standaloneDir = join(root, '.next', 'standalone');
const serverJs = join(standaloneDir, 'server.js');

function loadEnvLocal() {
  const envPath = join(root, '.env.local');
  if (!existsSync(envPath)) {
    console.warn('WARN: .env.local not found — API routes may return 500 without MONGODB_URI');
    return;
  }
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    if (!process.env[key]) process.env[key] = value;
  }
}

function ensureStaticAssets() {
  const src = join(root, '.next', 'static');
  const dest = join(standaloneDir, '.next', 'static');
  if (!existsSync(src)) return;
  mkdirSync(dest, { recursive: true });
  cpSync(src, dest, { recursive: true });
}

loadEnvLocal();

if (!existsSync(serverJs)) {
  console.error('FAIL: .next/standalone/server.js not found. Run `npm run build` first.');
  process.exit(1);
}

ensureStaticAssets();

process.env.NODE_ENV = 'production';
process.env.PORT = process.env.PORT || '3000';
process.env.HOSTNAME = process.env.HOSTNAME || '0.0.0.0';

console.log(`Starting standalone server on http://localhost:${process.env.PORT}`);

const child = spawn(process.execPath, ['server.js'], {
  cwd: standaloneDir,
  stdio: 'inherit',
  env: process.env,
});

child.on('exit', (code) => process.exit(code ?? 0));
