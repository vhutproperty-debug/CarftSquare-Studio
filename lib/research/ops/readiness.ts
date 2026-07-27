/**
 * Unified operator-facing connector state + production readiness score.
 * Additive — does not replace persistence enums.
 */

import type { ConnectorDisplayState } from '@/lib/research/browser-gateway/connector-status';
import type { ConnectorStatusCard } from '@/lib/research/browser-gateway/types';
import type { CompatCheck } from '@/lib/research/ops/metrics';
import type { ProductionMetrics } from '@/lib/research/ops/metrics';

/** Unified 4-state model for operators / Prop AI gating. */
export type UnifiedConnectorState =
  | 'connected'
  | 'research_ready'
  | 'reconnect_required'
  | 'error';

export const UNIFIED_STATE_LABEL: Record<UnifiedConnectorState, string> = {
  connected: 'Connected',
  research_ready: 'Research Ready',
  reconnect_required: 'Reconnect Required',
  error: 'Error',
};

export function toUnifiedConnectorState(input: {
  displayState: ConnectorDisplayState;
  availableForResearch: boolean;
  portalDegraded?: boolean;
}): UnifiedConnectorState {
  if (input.displayState === 'connection_failed') return 'error';
  if (
    input.displayState === 'session_expired' ||
    input.displayState === 'never_connected'
  ) {
    return 'reconnect_required';
  }
  if (input.displayState === 'reconnecting') return 'connected';
  if (input.displayState === 'connected' && input.availableForResearch && !input.portalDegraded) {
    return 'research_ready';
  }
  if (input.displayState === 'connected') return 'connected';
  return 'reconnect_required';
}

export type ReadinessFactor = {
  id: string;
  label: string;
  weight: number;
  score: number; // 0–100 for this factor
  pass: boolean;
  detail: string;
};

export type ProductionReadinessReport = {
  at: string;
  score: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  factors: ReadinessFactor[];
  explanations: string[];
  blockers: string[];
};

export function computeProductionReadinessScore(input: {
  workerOnline: boolean;
  workerHealthy: boolean;
  compat: CompatCheck;
  metrics?: ProductionMetrics | null;
  connectors: Array<
    Pick<
      ConnectorStatusCard,
      | 'portal'
      | 'availableForResearch'
      | 'displayState'
      | 'sessionExists'
      | 'diagnostics'
    > & { opsState?: UnifiedConnectorState; portalDegraded?: boolean }
  >;
}): ProductionReadinessReport {
  const factors: ReadinessFactor[] = [];

  factors.push({
    id: 'worker',
    label: 'Browser Worker online & healthy',
    weight: 20,
    score: input.workerOnline && input.workerHealthy ? 100 : input.workerOnline ? 50 : 0,
    pass: input.workerOnline && input.workerHealthy,
    detail: input.workerOnline
      ? input.workerHealthy
        ? 'Worker healthy'
        : 'Worker online but unhealthy'
      : 'Worker offline',
  });

  factors.push({
    id: 'compat',
    label: 'Worker/App protocol compatibility',
    weight: 15,
    score: input.compat.ok ? 100 : 0,
    pass: input.compat.ok,
    detail: input.compat.reason || `protocol ${input.compat.workerProtocol}`,
  });

  const ready = input.connectors.filter(
    (c) => c.opsState === 'research_ready' || c.availableForResearch,
  ).length;
  const total = Math.max(1, input.connectors.length);
  const readyPct = Math.round((ready / total) * 100);
  factors.push({
    id: 'portals_ready',
    label: 'Portals Research Ready',
    weight: 25,
    score: readyPct,
    pass: readyPct >= 60,
    detail: `${ready}/${input.connectors.length} research ready`,
  });

  const withSession = input.connectors.filter((c) => c.sessionExists).length;
  factors.push({
    id: 'sessions',
    label: 'Encrypted sessions present',
    weight: 15,
    score: Math.round((withSession / total) * 100),
    pass: withSession > 0,
    detail: `${withSession}/${input.connectors.length} have storageState/cookies`,
  });

  const errors = input.connectors.filter(
    (c) => c.displayState === 'connection_failed' || c.opsState === 'error',
  ).length;
  factors.push({
    id: 'errors',
    label: 'Connector error rate',
    weight: 10,
    score: Math.max(0, 100 - Math.round((errors / total) * 100)),
    pass: errors === 0,
    detail: errors === 0 ? 'No error-state portals' : `${errors} portal(s) in error`,
  });

  const successRate = input.metrics?.sessions.researchSuccessRate;
  factors.push({
    id: 'research_success',
    label: 'Research success rate (process lifetime)',
    weight: 10,
    score: successRate == null ? 70 : Math.min(100, successRate),
    pass: successRate == null || successRate >= 50,
    detail:
      successRate == null
        ? 'No searches yet this process (neutral 70)'
        : `${successRate}% (${input.metrics?.sessions.searchesOk}/${(input.metrics?.sessions.searchesOk || 0) + (input.metrics?.sessions.searchesFailed || 0)})`,
  });

  const mem = input.metrics?.process.memoryRssMb;
  factors.push({
    id: 'memory',
    label: 'Worker memory headroom',
    weight: 5,
    score: mem == null ? 80 : mem < 1500 ? 100 : mem < 2500 ? 70 : 40,
    pass: mem == null || mem < 2500,
    detail: mem == null ? 'Metrics unavailable' : `RSS ${mem} MB`,
  });

  let weighted = 0;
  let weightSum = 0;
  for (const f of factors) {
    weighted += (f.score * f.weight) / 100;
    weightSum += f.weight;
  }
  const score = weightSum > 0 ? Math.round((weighted / weightSum) * 100) : 0;
  const grade: ProductionReadinessReport['grade'] =
    score >= 90 ? 'A' : score >= 75 ? 'B' : score >= 60 ? 'C' : score >= 40 ? 'D' : 'F';

  const explanations = factors.map(
    (f) => `${f.label}: ${f.score}/100 (weight ${f.weight}) — ${f.detail}`,
  );
  const blockers = factors.filter((f) => !f.pass && f.weight >= 15).map((f) => f.detail);

  return {
    at: new Date().toISOString(),
    score,
    grade,
    factors,
    explanations,
    blockers,
  };
}
