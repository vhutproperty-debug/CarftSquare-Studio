/**
 * @deprecated Import from `@/lib/research/auth-detection/auth-evidence-engine`.
 * Compatibility shim for BasePortalConnector / connectors.
 */

import type { Page } from 'playwright';
import {
  AUTH_CONFIDENCE_THRESHOLD,
  evaluatePageAuth,
  scoreAuthEvidence,
  type AuthEvidenceResult,
  type AuthEvidenceSignal,
} from '@/lib/research/auth-detection/auth-evidence-engine';

export const LOGIN_CONFIDENCE_THRESHOLD = AUTH_CONFIDENCE_THRESHOLD;

export type LoginConfidenceSignal = {
  name: string;
  pass: boolean;
  weight: number;
  detail?: string;
};

export type LoginConfidenceResult = {
  authenticated: boolean;
  confidence: number;
  threshold: number;
  signals: LoginConfidenceSignal[];
  summary: string;
};

export type LoginConfidenceInput = {
  url: string;
  title?: string;
  body: string;
  cookieCount: number;
  extra?: LoginConfidenceSignal[];
  threshold?: number;
  localStorageKeys?: string[];
  sessionStorageKeys?: string[];
  cookieNames?: string[];
};

export function scoreLoginConfidence(input: LoginConfidenceInput): LoginConfidenceResult {
  const names =
    input.cookieNames ||
    Array.from({ length: input.cookieCount }, (_, i) => `cookie_${i}`);
  const result = scoreAuthEvidence({
    url: input.url,
    title: input.title,
    bodyHtml: input.body,
    cookies: names.map((name) => ({ name })),
    localStorageKeys: input.localStorageKeys,
    sessionStorageKeys: input.sessionStorageKeys,
    mode: 'verify',
  });
  return mapResult(result, input.extra);
}

export async function evaluatePageLoginConfidence(
  page: Page,
  extra?: LoginConfidenceSignal[],
  _threshold?: number,
): Promise<LoginConfidenceResult> {
  const result = await evaluatePageAuth(page, { mode: 'verify' });
  return mapResult(result, extra);
}

function mapResult(
  result: AuthEvidenceResult,
  extra?: LoginConfidenceSignal[],
): LoginConfidenceResult {
  const signals: LoginConfidenceSignal[] = [
    ...result.signals.map((s: AuthEvidenceSignal) => ({
      name: s.id,
      pass: s.pass,
      weight: s.maxPoints,
      detail: s.detail,
    })),
    ...(extra || []),
  ];
  return {
    authenticated: result.authenticated,
    confidence: result.confidence,
    threshold: result.threshold,
    signals,
    summary: result.summary,
  };
}
