/**
 * Centralized delivery / retry configuration (env-overridable, not scattered).
 */

export type DeliveryRetryConfig = {
  maxAttempts: number;
  /** Base delay in ms before first retry */
  baseDelayMs: number;
  /** Exponential multiplier per attempt */
  backoffFactor: number;
  /** Cap on delay */
  maxDelayMs: number;
  /** Random jitter fraction 0–1 applied to delay */
  jitterFraction: number;
  /** Max concurrent retry claims per tick */
  concurrency: number;
  /** Per-tick rate limit for retry sends */
  maxRetriesPerTick: number;
  /** Stuck SUBMITTING reclaim TTL */
  submittingTtlMs: number;
  /** Unknown failures: max conservative retries before permanent/manual */
  unknownMaxAttempts: number;
};

function intEnv(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function floatEnv(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

export function getDeliveryRetryConfig(): DeliveryRetryConfig {
  return {
    // Initial send + up to 2 automatic retries (Arun: max 2 retries for 131049-class).
    maxAttempts: intEnv('WA_DELIVERY_MAX_ATTEMPTS', 3),
    baseDelayMs: intEnv('WA_DELIVERY_BASE_DELAY_MS', 60_000),
    backoffFactor: floatEnv('WA_DELIVERY_BACKOFF_FACTOR', 2),
    maxDelayMs: intEnv('WA_DELIVERY_MAX_DELAY_MS', 48 * 60 * 60 * 1000),
    jitterFraction: floatEnv('WA_DELIVERY_JITTER', 0.2),
    concurrency: intEnv('WA_DELIVERY_RETRY_CONCURRENCY', 5),
    maxRetriesPerTick: intEnv('WA_DELIVERY_MAX_RETRIES_PER_TICK', 20),
    submittingTtlMs: intEnv('WA_DELIVERY_SUBMITTING_TTL_MS', 120_000),
    unknownMaxAttempts: intEnv('WA_DELIVERY_UNKNOWN_MAX_ATTEMPTS', 2),
  };
}

export function computeRetryDelayMs(attemptNumber: number, config = getDeliveryRetryConfig()): number {
  const exp = Math.min(
    config.maxDelayMs,
    config.baseDelayMs * config.backoffFactor ** Math.max(0, attemptNumber - 1),
  );
  const jitter = exp * config.jitterFraction * Math.random();
  return Math.floor(exp + jitter);
}

/** Codes that Meta asks us to wait ≥24h before retrying. */
export const LONG_DELAY_FAILURE_CODES = new Set(['131049', '130472', '131026']);

export function computeRetryDelayMsForFailure(
  attemptNumber: number,
  failureCode: string | null | undefined,
  config = getDeliveryRetryConfig(),
): number {
  const code = (failureCode || '').toString().trim();
  if (LONG_DELAY_FAILURE_CODES.has(code)) {
    // ≥24h, grow gently on later attempts, capped by maxDelayMs.
    const dayMs = 24 * 60 * 60 * 1000;
    const exp = Math.min(config.maxDelayMs, dayMs * (attemptNumber <= 1 ? 1 : 2));
    const jitter = exp * config.jitterFraction * Math.random();
    return Math.floor(exp + jitter);
  }
  return computeRetryDelayMs(attemptNumber, config);
}
