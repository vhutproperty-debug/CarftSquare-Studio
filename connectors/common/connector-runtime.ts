/**
 * In-process connector runtime registry — state, health, recovery counters.
 * Lives on the Browser Worker (and local non-serverless hosts). Vercel has no Chromium;
 * status API merges stored session diagnostics instead.
 */

import type { ConnectorLifecycleState } from '@/connectors/common/connector-lifecycle';
import { transitionOrThrow } from '@/connectors/common/connector-lifecycle';
import { connectorLog } from '@/lib/research/browser/connector-log';

export type ConnectorRuntimeSnapshot = {
  portal: string;
  workspaceId: string;
  state: ConnectorLifecycleState;
  workerPid: number;
  browserUptimeMs: number | null;
  contextAgeMs: number | null;
  sessionAgeMs: number | null;
  cookieCount: number | null;
  storageRestored: boolean | null;
  lastSuccessfulLoginAt: string | null;
  lastSuccessfulSearchAt: string | null;
  loginConfidence: number | null;
  portalReachable: boolean | null;
  recoveryAttempts: number;
  failureReason: string | null;
  suggestedAction: string | null;
  updatedAt: string;
};

type RuntimeEntry = {
  portal: string;
  workspaceId: string;
  state: ConnectorLifecycleState;
  browserOpenedAt: number | null;
  contextOpenedAt: number | null;
  sessionRestoredAt: number | null;
  cookieCount: number | null;
  storageRestored: boolean | null;
  lastSuccessfulLoginAt: string | null;
  lastSuccessfulSearchAt: string | null;
  loginConfidence: number | null;
  portalReachable: boolean | null;
  recoveryAttempts: number;
  failureReason: string | null;
  suggestedAction: string | null;
};

function keyOf(workspaceId: string, portal: string): string {
  return `${workspaceId}::${portal}`;
}

class ConnectorRuntimeRegistry {
  private readonly entries = new Map<string, RuntimeEntry>();

  getOrCreate(workspaceId: string, portal: string): RuntimeEntry {
    const key = keyOf(workspaceId, portal);
    let entry = this.entries.get(key);
    if (!entry) {
      entry = {
        portal,
        workspaceId,
        state: 'disconnected',
        browserOpenedAt: null,
        contextOpenedAt: null,
        sessionRestoredAt: null,
        cookieCount: null,
        storageRestored: null,
        lastSuccessfulLoginAt: null,
        lastSuccessfulSearchAt: null,
        loginConfidence: null,
        portalReachable: null,
        recoveryAttempts: 0,
        failureReason: null,
        suggestedAction: null,
      };
      this.entries.set(key, entry);
    }
    return entry;
  }

  /** Reset lifecycle for a fresh Connect / open cycle. */
  reset(workspaceId: string, portal: string): void {
    const entry = this.getOrCreate(workspaceId, portal);
    entry.state = 'disconnected';
    entry.failureReason = null;
    entry.suggestedAction = null;
    connectorLog(portal, 'lifecycle_reset', { workspaceId });
  }

  transition(
    workspaceId: string,
    portal: string,
    to: ConnectorLifecycleState,
    detail?: Record<string, unknown>,
  ): ConnectorLifecycleState {
    const entry = this.getOrCreate(workspaceId, portal);
    const from = entry.state;
    try {
      entry.state = transitionOrThrow(from, to);
    } catch {
      // Recovery paths may jump — force to target and log.
      connectorLog(portal, 'lifecycle_force_transition', { from, to, ...detail }, 'warn');
      entry.state = to;
    }
    connectorLog(portal, 'lifecycle_transition', { from, to: entry.state, ...detail });
    if (to === 'open_browser' || to === 'open_new_browser') {
      entry.browserOpenedAt = Date.now();
      entry.contextOpenedAt = Date.now();
    }
    if (to === 'load_persistent_profile') {
      entry.contextOpenedAt = Date.now();
    }
    if (to === 'restore_session' || to === 'restore_profile') {
      entry.sessionRestoredAt = Date.now();
    }
    if (to === 'error') {
      entry.recoveryAttempts += 1;
    }
    if (to === 'ready' || to === 'idle') {
      entry.failureReason = null;
      entry.suggestedAction = null;
    }
    return entry.state;
  }

  markSessionRestored(
    workspaceId: string,
    portal: string,
    info: { cookieCount: number; storageRestored: boolean },
  ): void {
    const entry = this.getOrCreate(workspaceId, portal);
    entry.cookieCount = info.cookieCount;
    entry.storageRestored = info.storageRestored;
    entry.sessionRestoredAt = Date.now();
  }

  markLogin(
    workspaceId: string,
    portal: string,
    info: { confidence: number; ok: boolean },
  ): void {
    const entry = this.getOrCreate(workspaceId, portal);
    entry.loginConfidence = info.confidence;
    entry.portalReachable = true;
    if (info.ok) {
      entry.lastSuccessfulLoginAt = new Date().toISOString();
      entry.failureReason = null;
    }
  }

  markSearch(workspaceId: string, portal: string, ok: boolean): void {
    const entry = this.getOrCreate(workspaceId, portal);
    if (ok) {
      entry.lastSuccessfulSearchAt = new Date().toISOString();
    }
  }

  markFailure(
    workspaceId: string,
    portal: string,
    reason: string,
    suggestedAction: string,
  ): void {
    const entry = this.getOrCreate(workspaceId, portal);
    entry.failureReason = reason;
    entry.suggestedAction = suggestedAction;
    this.transition(workspaceId, portal, 'error', { reason });
  }

  snapshot(workspaceId: string, portal: string): ConnectorRuntimeSnapshot {
    const entry = this.getOrCreate(workspaceId, portal);
    const now = Date.now();
    return {
      portal,
      workspaceId,
      state: entry.state,
      workerPid: process.pid,
      browserUptimeMs: entry.browserOpenedAt != null ? now - entry.browserOpenedAt : null,
      contextAgeMs: entry.contextOpenedAt != null ? now - entry.contextOpenedAt : null,
      sessionAgeMs: entry.sessionRestoredAt != null ? now - entry.sessionRestoredAt : null,
      cookieCount: entry.cookieCount,
      storageRestored: entry.storageRestored,
      lastSuccessfulLoginAt: entry.lastSuccessfulLoginAt,
      lastSuccessfulSearchAt: entry.lastSuccessfulSearchAt,
      loginConfidence: entry.loginConfidence,
      portalReachable: entry.portalReachable,
      recoveryAttempts: entry.recoveryAttempts,
      failureReason: entry.failureReason,
      suggestedAction: entry.suggestedAction,
      updatedAt: new Date().toISOString(),
    };
  }

  /** Snapshot only if this process has tracked the connector (worker). */
  peek(workspaceId: string, portal: string): ConnectorRuntimeSnapshot | null {
    const key = keyOf(workspaceId, portal);
    if (!this.entries.has(key)) return null;
    return this.snapshot(workspaceId, portal);
  }

  listForWorkspace(workspaceId: string): ConnectorRuntimeSnapshot[] {
    return [...this.entries.values()]
      .filter((e) => e.workspaceId === workspaceId)
      .map((e) => this.snapshot(e.workspaceId, e.portal));
  }

  /** All in-process connector runtimes (Browser Worker). */
  listAll(): ConnectorRuntimeSnapshot[] {
    return [...this.entries.values()].map((e) => this.snapshot(e.workspaceId, e.portal));
  }
}

export const connectorRuntime = new ConnectorRuntimeRegistry();
