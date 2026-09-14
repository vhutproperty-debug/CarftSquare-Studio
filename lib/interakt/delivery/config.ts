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
    maxAttempts: intEnv('INTERAKT_DELIVERY_MAX_ATTEMPTS', 5),
    baseDelayMs: intEnv('INTERAKT_DELIVERY_BASE_DELAY_MS', 60_000),
    backoffFactor: floatEnv('INTERAKT_DELIVERY_BACKOFF_FACTOR', 2),
    maxDelayMs: intEnv('INTERAKT_DELIVERY_MAX_DELAY_MS', 3_600_000),
    jitterFraction: floatEnv('INTERAKT_DELIVERY_JITTER', 0.2),
    concurrency: intEnv('INTERAKT_DELIVERY_RETRY_CONCURRENCY', 5),
    maxRetriesPerTick: intEnv('INTERAKT_DELIVERY_MAX_RETRIES_PER_TICK', 20),
    submittingTtlMs: intEnv('INTERAKT_DELIVERY_SUBMITTING_TTL_MS', 120_000),
    unknownMaxAttempts: intEnv('INTERAKT_DELIVERY_UNKNOWN_MAX_ATTEMPTS', 2),
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
