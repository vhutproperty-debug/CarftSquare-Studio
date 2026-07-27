/**
 * Continuous connector health monitor — runs on the Browser Worker.
 * Deep-checks idle/ready connectors and triggers recovery on browser lifecycle failures.
 * Auth expiry stays needs_login (no silent reconnect inventing credentials).
 */

import { connectorRuntime } from '@/connectors/common/connector-runtime';
import { getPortalConnector } from '@/connectors/registry';
import { connectorLog } from '@/lib/research/browser/connector-log';
import { isServerlessPlaywrightHost } from '@/lib/research/browser/playwright-runtime-guard';
import type { BasePortalConnector } from '@/connectors/common/base-connector';

const DEFAULT_INTERVAL_MS = Number(process.env.RESEARCH_CONNECTOR_HEALTH_MS || 5 * 60 * 1000);

let timer: ReturnType<typeof setInterval> | null = null;
let ticking = false;

function isLifecycleFailure(message: string): boolean {
  return /page crashed|target (closed|page)|browser (has been )?closed|context.*(destroyed|closed)|session closed|disconnected/i.test(
    message,
  );
}

async function deepCheckPair(workspaceId: string, portal: string): Promise<void> {
  const snap = connectorRuntime.snapshot(workspaceId, portal);
  if (snap.state !== 'idle' && snap.state !== 'ready' && snap.state !== 'health_check') {
    return;
  }

  connectorRuntime.transition(workspaceId, portal, 'health_check');
  const connector = getPortalConnector(portal) as BasePortalConnector | null;
  if (!connector) return;

  try {
    const result = await connector.validateSession(workspaceId);
    if (result.ok) {
      connectorRuntime.transition(workspaceId, portal, 'idle');
      return;
    }

    const message = result.message || result.status;
    if (isLifecycleFailure(message)) {
      await connector.recoverBrowser(workspaceId, message);
      return;
    }

    connectorRuntime.markFailure(
      workspaceId,
      portal,
      message,
      /login|auth|otp/i.test(message)
        ? 'Authentication expired — reconnect this portal.'
        : 'Retry validation or reconnect if the failure persists.',
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    connectorLog(portal, 'health_monitor_pair_error', { workspaceId, message }, 'error');
    if (isLifecycleFailure(message)) {
      await connector.recoverBrowser(workspaceId, message);
    }
  }
}

async function tick(): Promise<void> {
  if (ticking || isServerlessPlaywrightHost()) return;
  ticking = true;
  try {
    const pairs = connectorRuntime.listAll().filter(
      (s) => s.state === 'idle' || s.state === 'ready' || s.state === 'health_check',
    );
    for (const snap of pairs) {
      await deepCheckPair(snap.workspaceId, snap.portal);
    }
  } catch (error) {
    connectorLog(
      'framework',
      'health_monitor_exception',
      { error: error instanceof Error ? error.message : String(error) },
      'error',
    );
  } finally {
    ticking = false;
  }
}

/** Start periodic health ticks. Idempotent. No-op on serverless hosts. */
export function startConnectorHealthMonitor(opts?: { intervalMs?: number }): void {
  if (isServerlessPlaywrightHost()) return;
  if (timer) return;

  const intervalMs = opts?.intervalMs ?? DEFAULT_INTERVAL_MS;
  timer = setInterval(() => {
    void tick();
  }, intervalMs);

  if (typeof timer === 'object' && timer && 'unref' in timer) {
    (timer as NodeJS.Timeout).unref();
  }

  connectorLog('framework', 'health_monitor_started', { intervalMs });
}

export function stopConnectorHealthMonitor(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
