/**
 * Run next build with a hard timeout and tee output to tmp/deploy-build.log
 * Usage: node scripts/run-build-with-timeout.mjs [timeoutMs]
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const timeoutMs = Number(process.argv[2] || 10 * 60 * 1000);
const root = process.cwd();
const logPath = path.join(root, 'tmp', 'deploy-build.log');
fs.mkdirSync(path.dirname(logPath), { recursive: true });
const log = fs.createWriteStream(logPath, { flags: 'w' });

function write(chunk) {
  process.stdout.write(chunk);
  log.write(chunk);
}

write(`build_start timeoutMs=${timeoutMs} at=${new Date().toISOString()}\n`);

const child = spawn(
  process.platform === 'win32' ? 'npx.cmd' : 'npx',
  ['next', 'build'],
  {
    cwd: root,
    env: { ...process.env, FORCE_COLOR: '0', CI: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: true,
  },
);

let settled = false;
const timer = setTimeout(() => {
  if (settled) return;
  write(`\nBUILD_TIMEOUT after ${timeoutMs}ms — killing process tree\n`);
  try {
    if (process.platform === 'win32') {
      spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
    } else {
      child.kill('SIGKILL');
    }
  } catch {
    /* ignore */
  }
  settled = true;
  log.end();
  process.exit(124);
}, timeoutMs);

child.stdout.on('data', (d) => write(d));
child.stderr.on('data', (d) => write(d));
child.on('error', (err) => {
  write(`\nBUILD_SPAWN_ERROR ${err.message}\n`);
});
child.on('close', (code, signal) => {
  if (settled) return;
  settled = true;
  clearTimeout(timer);
  write(`\nBUILD_EXIT code=${code} signal=${signal || 'none'} at=${new Date().toISOString()}\n`);
  log.end(() => process.exit(code ?? 1));
});
