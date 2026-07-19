import { NextResponse } from 'next/server';
import { authResultToResponse } from '@/lib/auth/rbac/guard';
import { requireResearchViewAccess } from '@/lib/research/auth';
import {
  fetchBrowserWorkerStatus,
  pingBrowserWorkerHeartbeat,
} from '@/lib/research/browser-gateway/worker-client';

export const runtime = 'nodejs';

/**
 * Browser Worker status for Prop/Research.
 * Probes the worker HTTP control plane (never launches Playwright).
 */
export async function GET(request: Request) {
  const auth = await requireResearchViewAccess(request);
  const denied = authResultToResponse(auth);
  if (denied) return denied;

  const ping = new URL(request.url).searchParams.get('ping') === '1';
  if (ping) {
    await pingBrowserWorkerHeartbeat();
  }

  const status = await fetchBrowserWorkerStatus();
  return NextResponse.json({
    online: status.online,
    provider: status.provider,
    queueSize: status.queueSize,
    activeSessions: status.activeSessions,
    uptime: status.uptime,
    version: status.version,
    lastHeartbeatAt: status.lastHeartbeatAt,
    lastError: status.lastError,
    port: status.port,
    workerId: status.workerId,
    healthy: status.healthy,
    source: status.source,
    workerHost: status.workerHost,
    workerUrlIsLocalhost: status.workerUrlIsLocalhost,
  });
}
