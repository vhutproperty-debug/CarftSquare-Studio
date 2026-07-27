/**
 * Worker ↔ App version compatibility + production metrics counters.
 */

import os from 'os';
import { researchBrowserPool } from '@/lib/research/browser/browser-pool';
import { connectorRuntime } from '@/connectors/common/connector-runtime';

/** Bump when Connect phase / storageState / verifyUrl contracts change. */
export const RESEARCH_PROTOCOL_VERSION = '2.0.0';

/** App expects workers at this major protocol version. */
export const APP_EXPECTED_PROTOCOL_VERSION =
  process.env.RESEARCH_PROTOCOL_VERSION?.trim() || RESEARCH_PROTOCOL_VERSION;

export type CompatCheck = {
  ok: boolean;
  appProtocol: string;
  workerProtocol: string;
  workerHttpVersion: string;
  reason: string | null;
};

export function checkWorkerAppCompat(input: {
  workerProtocol?: string | null;
  workerHttpVersion?: string | null;
}): CompatCheck {
  const workerProtocol = input.workerProtocol || '';
  const appProtocol = APP_EXPECTED_PROTOCOL_VERSION;
  if (!workerProtocol) {
    return {
      ok: false,
      appProtocol,
      workerProtocol: '',
      workerHttpVersion: input.workerHttpVersion || '',
      reason: 'Worker did not report protocolVersion — redeploy Browser Worker',
    };
  }
  const appMajor = appProtocol.split('.')[0];
  const workerMajor = workerProtocol.split('.')[0];
  if (appMajor !== workerMajor) {
    return {
      ok: false,
      appProtocol,
      workerProtocol,
      workerHttpVersion: input.workerHttpVersion || '',
      reason: `Protocol major mismatch app=${appProtocol} worker=${workerProtocol}. Deploy worker + app together.`,
    };
  }
  return {
    ok: true,
    appProtocol,
    workerProtocol,
    workerHttpVersion: input.workerHttpVersion || '',
    reason: null,
  };
}

export type ProductionMetrics = {
  at: string;
  process: {
    pid: number;
    uptimeSec: number;
    memoryRssMb: number;
    memoryHeapMb: number;
    cpuLoad1m: number | null;
  };
  browsers: {
    poolSize: number;
    /** Approximate — pool entries currently tracked. */
    activeContexts: number;
  };
  connectors: {
    runtimeTracked: number;
    idleOrReady: number;
  };
  sessions: {
    restoresOk: number;
    restoresFailed: number;
    searchesOk: number;
    searchesFailed: number;
    researchSuccessRate: number | null;
  };
  scavenger: {
    lastBootAt: string | null;
    chromiumKilled: number;
    profilesRemoved: number;
    artifactsRemoved: number;
  };
};

type Counters = {
  restoresOk: number;
  restoresFailed: number;
  searchesOk: number;
  searchesFailed: number;
  lastBootScavengeAt: string | null;
  chromiumKilled: number;
  profilesRemoved: number;
  artifactsRemoved: number;
};

const counters: Counters = {
  restoresOk: 0,
  restoresFailed: 0,
  searchesOk: 0,
  searchesFailed: 0,
  lastBootScavengeAt: null,
  chromiumKilled: 0,
  profilesRemoved: 0,
  artifactsRemoved: 0,
};

export function recordSessionRestore(ok: boolean): void {
  if (ok) counters.restoresOk += 1;
  else counters.restoresFailed += 1;
}

export function recordResearchSearch(ok: boolean): void {
  if (ok) counters.searchesOk += 1;
  else counters.searchesFailed += 1;
}

export function recordBootScavenge(report: {
  chromiumKilled: number;
  profilesRemoved: number;
  artifactsRemoved: number;
}): void {
  counters.lastBootScavengeAt = new Date().toISOString();
  counters.chromiumKilled += report.chromiumKilled;
  counters.profilesRemoved += report.profilesRemoved;
  counters.artifactsRemoved += report.artifactsRemoved;
}

export function getProductionMetrics(): ProductionMetrics {
  const mem = process.memoryUsage();
  const load = os.loadavg?.()?.[0];
  const runtimes = connectorRuntime.listAll();
  const poolSize = researchBrowserPool.size();
  const inUse = researchBrowserPool.inUseCount();

  const totalSearches = counters.searchesOk + counters.searchesFailed;
  return {
    at: new Date().toISOString(),
    process: {
      pid: process.pid,
      uptimeSec: Math.floor(process.uptime()),
      memoryRssMb: Math.round(mem.rss / 1024 / 1024),
      memoryHeapMb: Math.round(mem.heapUsed / 1024 / 1024),
      cpuLoad1m: typeof load === 'number' ? Math.round(load * 100) / 100 : null,
    },
    browsers: {
      poolSize,
      activeContexts: inUse,
    },
    connectors: {
      runtimeTracked: runtimes.length,
      idleOrReady: runtimes.filter((r) => r.state === 'idle' || r.state === 'ready').length,
    },
    sessions: {
      restoresOk: counters.restoresOk,
      restoresFailed: counters.restoresFailed,
      searchesOk: counters.searchesOk,
      searchesFailed: counters.searchesFailed,
      researchSuccessRate:
        totalSearches > 0
          ? Math.round((counters.searchesOk / totalSearches) * 1000) / 10
          : null,
    },
    scavenger: {
      lastBootAt: counters.lastBootScavengeAt,
      chromiumKilled: counters.chromiumKilled,
      profilesRemoved: counters.profilesRemoved,
      artifactsRemoved: counters.artifactsRemoved,
    },
  };
}

export function getBrowserPoolSize(): number {
  return researchBrowserPool.size();
}
