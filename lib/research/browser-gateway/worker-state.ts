import type { BrowserProviderKind } from '@/lib/research/browser-gateway/types';
import { RESEARCH_PROTOCOL_VERSION } from '@/lib/research/ops/metrics';

export const WORKER_HTTP_VERSION = '1.2.1';

export type WorkerLogLine = {
  at: string;
  level: 'info' | 'warn' | 'error';
  message: string;
};

export type WorkerRuntimeState = {
  workerId: string;
  provider: BrowserProviderKind;
  port: number;
  startedAt: number;
  lastHeartbeatAt: string;
  lastError: string | null;
  activeConnectSessionId: string | null;
  activePortal: string | null;
  /** Parallel in-flight Connect session ids (capacity tracking). */
  activeConnectSessionIds: string[];
  ticks: number;
  jobsProcessed: number;
  healthy: boolean;
  logs: WorkerLogLine[];
};

const MAX_LOGS = 200;

let state: WorkerRuntimeState | null = null;

export function initWorkerState(input: {
  workerId: string;
  provider: BrowserProviderKind;
  port: number;
}): WorkerRuntimeState {
  state = {
    workerId: input.workerId,
    provider: input.provider,
    port: input.port,
    startedAt: Date.now(),
    lastHeartbeatAt: new Date().toISOString(),
    lastError: null,
    activeConnectSessionId: null,
    activePortal: null,
    activeConnectSessionIds: [],
    ticks: 0,
    jobsProcessed: 0,
    healthy: true,
    logs: [],
  };
  pushWorkerLog('info', `Worker initialized (provider=${input.provider}, port=${input.port})`);
  return state;
}

export function getWorkerState(): WorkerRuntimeState | null {
  return state;
}

export function touchWorkerHeartbeat(): void {
  if (!state) return;
  state.lastHeartbeatAt = new Date().toISOString();
  state.healthy = true;
}

export function setWorkerActiveJob(sessionId: string | null, portal: string | null): void {
  if (!state) return;
  state.activeConnectSessionId = sessionId;
  state.activePortal = portal;
  if (sessionId && !state.activeConnectSessionIds.includes(sessionId)) {
    state.activeConnectSessionIds.push(sessionId);
  }
}

export function markWorkerJobDone(sessionId?: string | null): void {
  if (!state) return;
  state.jobsProcessed += 1;
  if (sessionId) {
    state.activeConnectSessionIds = state.activeConnectSessionIds.filter((id) => id !== sessionId);
  } else if (state.activeConnectSessionId) {
    state.activeConnectSessionIds = state.activeConnectSessionIds.filter(
      (id) => id !== state!.activeConnectSessionId,
    );
  }
  state.activeConnectSessionId = state.activeConnectSessionIds[0] || null;
  if (!state.activeConnectSessionId) state.activePortal = null;
}

export function getInflightConnectCount(): number {
  return state?.activeConnectSessionIds.length || 0;
}

export function bumpWorkerTick(): void {
  if (!state) return;
  state.ticks += 1;
  touchWorkerHeartbeat();
}

export function setWorkerError(message: string | null): void {
  if (!state) return;
  state.lastError = message;
  if (message) state.healthy = false;
  else state.healthy = true;
}

export function pushWorkerLog(level: WorkerLogLine['level'], message: string): void {
  if (!state) return;
  const line: WorkerLogLine = {
    at: new Date().toISOString(),
    level,
    message,
  };
  state.logs.push(line);
  if (state.logs.length > MAX_LOGS) {
    state.logs.splice(0, state.logs.length - MAX_LOGS);
  }
  const prefix = `[research-browser-worker]`;
  if (level === 'error') console.error(prefix, message);
  else if (level === 'warn') console.warn(prefix, message);
  else console.log(prefix, message);
}

export function getWorkerLogs(limit = 80): WorkerLogLine[] {
  if (!state) return [];
  return state.logs.slice(-limit);
}

export function buildWorkerStatusPayload(extra?: {
  queueSize?: number;
  activeSessions?: number;
  metrics?: unknown;
}) {
  if (!state) {
    return {
      online: false,
      provider: 'self_hosted' as BrowserProviderKind,
      queueSize: extra?.queueSize ?? 0,
      activeSessions: extra?.activeSessions ?? 0,
      uptime: 0,
      version: WORKER_HTTP_VERSION,
      protocolVersion: RESEARCH_PROTOCOL_VERSION,
      lastHeartbeatAt: null as string | null,
      lastError: 'Worker state not initialized',
      port: null as number | null,
      workerId: null as string | null,
      healthy: false,
      metrics: extra?.metrics ?? null,
    };
  }
  return {
    online: true,
    provider: state.provider,
    queueSize: extra?.queueSize ?? 0,
    activeSessions:
      extra?.activeSessions ??
      Math.max(state.activeConnectSessionIds.length, state.activeConnectSessionId ? 1 : 0),
    uptime: Math.floor((Date.now() - state.startedAt) / 1000),
    version: WORKER_HTTP_VERSION,
    protocolVersion: RESEARCH_PROTOCOL_VERSION,
    lastHeartbeatAt: state.lastHeartbeatAt,
    lastError: state.lastError,
    port: state.port,
    workerId: state.workerId,
    healthy: state.healthy,
    activePortal: state.activePortal,
    jobsProcessed: state.jobsProcessed,
    metrics: extra?.metrics ?? null,
  };
}
