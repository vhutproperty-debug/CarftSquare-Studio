import { NextResponse } from 'next/server';
import { authResultToResponse } from '@/lib/auth/rbac/guard';
import { requireResearchViewAccess } from '@/lib/research/auth';
import { DEFAULT_RESEARCH_WORKSPACE } from '@/lib/research/business';
import { listConnectorStatuses } from '@/lib/research/browser-gateway/gateway';
import { fetchBrowserWorkerStatus } from '@/lib/research/browser-gateway/worker-client';
import {
  checkWorkerAppCompat,
  APP_EXPECTED_PROTOCOL_VERSION,
} from '@/lib/research/ops/metrics';
import { computeProductionReadinessScore } from '@/lib/research/ops/readiness';
import { heartbeatAllPortals } from '@/lib/research/ops/connector-heartbeat';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * Production readiness score (0–100) + explanations.
 * Operational observability only — does not change connector architecture.
 */
export async function GET(request: Request) {
  const auth = await requireResearchViewAccess(request);
  const denied = authResultToResponse(auth);
  if (denied) return denied;

  const url = new URL(request.url);
  const workspaceId =
    url.searchParams.get('workspaceId') || DEFAULT_RESEARCH_WORKSPACE.id;
  const markStale = url.searchParams.get('heartbeat') === '1';

  try {
    const [worker, statusPack, heartbeats] = await Promise.all([
      fetchBrowserWorkerStatus(),
      listConnectorStatuses(workspaceId),
      heartbeatAllPortals({ workspaceId, markStale }).catch(() => []),
    ]);

    const compat =
      worker.compat ||
      checkWorkerAppCompat({
        workerProtocol: worker.protocolVersion,
        workerHttpVersion: worker.version,
      });

    const report = computeProductionReadinessScore({
      workerOnline: worker.online,
      workerHealthy: worker.healthy,
      compat,
      metrics: worker.metrics,
      connectors: statusPack.connectors,
    });

    return NextResponse.json({
      ok: true,
      workspaceId,
      readiness: report,
      worker: {
        online: worker.online,
        healthy: worker.healthy,
        version: worker.version,
        protocolVersion: worker.protocolVersion,
        expectedProtocol: APP_EXPECTED_PROTOCOL_VERSION,
        compat,
        metrics: worker.metrics,
        lastHeartbeatAt: worker.lastHeartbeatAt,
        lastError: worker.lastError,
        workerHost: worker.workerHost,
      },
      heartbeats,
      connectors: statusPack.connectors.map((c) => ({
        portal: c.portal,
        opsState: c.opsState,
        opsStateLabel: c.opsStateLabel,
        displayState: c.displayState,
        availableForResearch: c.availableForResearch,
        portalDegraded: c.portalDegraded,
        portalDegradationReason: c.portalDegradationReason,
      })),
    });
  } catch (error) {
    console.error('[research] production_readiness_failed', error);
    return NextResponse.json(
      { error: 'Failed to compute production readiness.' },
      { status: 500 },
    );
  }
}
