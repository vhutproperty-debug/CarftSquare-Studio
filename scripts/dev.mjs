/**
 * Start Next.js dev server with NODE_ENV=development.
 * Frees port 3000 on Windows when a stale node process is blocking startup.
 */
import { spawn, execSync } from 'child_process';
import { join } from 'path';

process.env.NODE_ENV = 'development';

function freePort3000() {
  if (process.platform !== 'win32') return;

  try {
    const out = execSync('netstat -ano | findstr :3000', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });
    const pids = new Set();
    for (const line of out.split('\n')) {
      if (!line.includes('LISTENING')) continue;
      const pid = line.trim().split(/\s+/).pop();
      if (pid && pid !== '0' && pid !== String(process.pid)) pids.add(pid);
    }
    for (const pid of pids) {
      try {
        execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore' });
        console.log(`[dev] Freed port 3000 (stopped PID ${pid})`);
      } catch {
        // Process may have already exited.
      }
    }
  } catch {
    // Port not in use — nothing to free.
  }
}

freePort3000();

const nextBin = join(process.cwd(), 'node_modules', 'next', 'dist', 'bin', 'next');

const child = spawn(process.execPath, [nextBin, 'dev', '--hostname', '0.0.0.0', '--port', '3000'], {
  stdio: 'inherit',
  env: process.env,
});

child.on('exit', (code) => process.exit(code ?? 0));
