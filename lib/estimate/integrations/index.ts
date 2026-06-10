import type { QuotationQuote } from '../types';
import type { EnquiryIntegrationHooks } from './types';

const hooks: EnquiryIntegrationHooks = {};

export function registerIntegrationHooks(next: EnquiryIntegrationHooks): void {
  Object.assign(hooks, next);
}

export async function notifyEnquiryCreated(quote: QuotationQuote): Promise<void> {
  try {
    await hooks.onEnquiryCreated?.(quote);
  } catch {
    // Integrations must never block core enquiry flow
  }
}

export async function notifyStatusChanged(quote: QuotationQuote, previousStatus: string): Promise<void> {
  try {
    await hooks.onStatusChanged?.(quote, previousStatus);
  } catch {
    // Non-blocking
  }
}
