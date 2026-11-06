import type { FailureClass } from '@/lib/whatsapp-cloud/delivery/types';
import { classifyWhatsAppError } from '@/lib/whatsapp-cloud/errors';

export type FailureClassification = {
  failureClass: FailureClass;
  reason: string;
  code: string | null;
};

/**
 * Classify Wa / API failures using available response fields.
 * Never assume retryable merely because send failed.
 */
export function classifyDeliveryFailure(input: {
  httpStatus?: number | null;
  apiMessage?: string | null;
  channelErrorCode?: string | null;
  channelFailureReason?: string | null;
  raw?: unknown;
}): FailureClassification {
  const code = (input.channelErrorCode || '').toString().trim() || null;
  const reason = (
    input.channelFailureReason
    || input.apiMessage
    || (input.httpStatus ? `HTTP ${input.httpStatus}` : null)
    || 'unknown_failure'
  )
    .toString()
    .slice(0, 500);

  const numeric = Number(code);
  if (code && Number.isFinite(numeric)) {
    const classified = classifyWhatsAppError(numeric, input.httpStatus);
    if (classified.kind === 'rate_limit' || classified.retryable) {
      return { failureClass: 'RETRYABLE', reason, code };
    }
    if (
      classified.kind === 'undeliverable'
      || classified.kind === 'template'
      || classified.kind === 'needs_template'
      || classified.kind === 'account_restricted'
      || classified.kind === 'permanent'
    ) {
      return { failureClass: 'PERMANENT', reason, code };
    }
  }

  const hay = `${code || ''} ${reason}`.toLowerCase();

  // Permanent patterns
  if (
    /\b(invalid.?phone|phone.?number.?invalid|not a valid|does not exist|user not found|undeliverable)\b/.test(hay)
    || /\b(opt.?out|opted.?out|unsubscribed|do not (message|contact)|blocked|blacklist)\b/.test(hay)
    || /\b(template.*(rejected|not.?approved|disabled|invalid)|policy|spam)\b/.test(hay)
    || /\b(131047|131050|131051|132000|132001|132005|132007|132012|132015|132016)\b/.test(hay)
    || input.httpStatus === 400
  ) {
    // 400 often permanent (bad request / invalid template / phone) — still check transient cues
    if (!/\b(rate.?limit|throttl|timeout|temporar|unavailable|429|503|502|504)\b/.test(hay)) {
      return { failureClass: 'PERMANENT', reason, code };
    }
  }

  // Retryable patterns
  if (
    input.httpStatus === 408
    || input.httpStatus === 429
    || (input.httpStatus != null && input.httpStatus >= 500)
    || /\b(rate.?limit|throttl|timeout|temporar|unavailable|try again|server error|network)\b/.test(hay)
    || /\b(130429|130472|131000|131016|131026|131048|131049)\b/.test(hay)
  ) {
    return { failureClass: 'RETRYABLE', reason, code };
  }

  if (!code && !input.channelFailureReason && !input.apiMessage && !input.httpStatus) {
    return { failureClass: 'UNKNOWN', reason: 'insufficient_failure_data', code: null };
  }

  return { failureClass: 'UNKNOWN', reason, code };
}
