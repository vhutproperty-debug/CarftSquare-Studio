export type WhatsAppErrorKind =
  | 'needs_template'
  | 'undeliverable'
  | 'rate_limit'
  | 'template'
  | 'account_restricted'
  | 'retryable'
  | 'permanent'
  | 'unknown';

export type ClassifiedWhatsAppError = {
  kind: WhatsAppErrorKind;
  retryable: boolean;
  pauseSends: boolean;
  code: number | null;
};

export function classifyWhatsAppError(
  code?: number | null,
  httpStatus?: number | null,
): ClassifiedWhatsAppError {
  const numeric = code == null || Number.isNaN(Number(code)) ? null : Number(code);

  if (numeric === 131047) {
    return { kind: 'needs_template', retryable: false, pauseSends: false, code: numeric };
  }
  // 131049 = per-user marketing ecosystem cap (async fail after accept).
  // 130472 = user in marketing experiment. Retry after a long delay.
  // 131026 = undeliverable; often transient (offline / old client) — retry once later.
  if (numeric === 131049 || numeric === 130472) {
    return { kind: 'rate_limit', retryable: true, pauseSends: false, code: numeric };
  }
  if (numeric === 131026) {
    return { kind: 'retryable', retryable: true, pauseSends: false, code: numeric };
  }
  if (numeric === 131021) {
    return { kind: 'undeliverable', retryable: false, pauseSends: false, code: numeric };
  }
  // 131050 = user stopped marketing messages — never retry.
  if (numeric === 131050) {
    return { kind: 'permanent', retryable: false, pauseSends: false, code: numeric };
  }
  if (numeric === 130429 || numeric === 131056 || numeric === 80007 || httpStatus === 429) {
    return { kind: 'rate_limit', retryable: true, pauseSends: false, code: numeric };
  }
  if (numeric != null && numeric >= 132000 && numeric <= 132015) {
    return { kind: 'template', retryable: false, pauseSends: false, code: numeric };
  }
  if (numeric === 368 || numeric === 131031) {
    return { kind: 'account_restricted', retryable: false, pauseSends: true, code: numeric };
  }
  if (httpStatus === 408 || (httpStatus != null && httpStatus >= 500)) {
    return { kind: 'retryable', retryable: true, pauseSends: false, code: numeric };
  }
  if (httpStatus === 400 || httpStatus === 403) {
    return { kind: 'permanent', retryable: false, pauseSends: false, code: numeric };
  }
  return { kind: 'unknown', retryable: false, pauseSends: false, code: numeric };
}
