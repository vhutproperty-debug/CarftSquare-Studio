import { spawn, spawnSync, type ChildProcessWithoutNullStreams } from 'child_process';
import { auditRemote } from '@/lib/research/browser-gateway/remote-display/audit';

export function spawnDetached(
  command: string,
  args: string[],
  env: Record<string, string | undefined>,
  label: string,
): ChildProcessWithoutNullStreams {
  const child = spawn(command, args, {
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: false,
  });
  child.stdout.on('data', (buf) => {
    const line = String(buf).trim();
    if (line) auditRemote('proc_stdout', { label, line: line.slice(0, 300) });
  });
  child.stderr.on('data', (buf) => {
    const line = String(buf).trim();
    if (line) auditRemote('proc_stderr', { label, line: line.slice(0, 300) }, 'warn');
  });
  child.on('exit', (code, signal) => {
    auditRemote('proc_exit', { label, code, signal }, code === 0 ? 'info' : 'warn');
  });
  return child;
}

export async function waitForPortOpen(
  host: string,
  port: number,
  timeoutMs = 15_000,
): Promise<void> {
  const net = await import('net');
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const ok = await new Promise<boolean>((resolve) => {
      const socket = net.createConnection({ host, port }, () => {
        socket.end();
        resolve(true);
      });
      socket.on('error', () => resolve(false));
    });
    if (ok) return;
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`Timed out waiting for ${host}:${port} (${timeoutMs}ms)`);
}

export function killProcessTree(pid: number | null | undefined, label: string) {
  if (!pid || pid <= 0) return;
  try {
    process.kill(pid, 'SIGTERM');
    auditRemote('proc_kill', { label, pid, signal: 'SIGTERM' });
  } catch {
    /* already gone */
  }
  setTimeout(() => {
    try {
      process.kill(pid, 'SIGKILL');
    } catch {
      /* ignore */
    }
  }, 1500);
}

export function commandExists(bin: string): boolean {
  try {
    const result =
      process.platform === 'win32'
        ? spawnSync('where', [bin], { encoding: 'utf8' })
        : spawnSync('which', [bin], { encoding: 'utf8' });
    return result.status === 0 && Boolean(result.stdout?.trim());
  } catch {
    return false;
  }
}
