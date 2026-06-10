import type { QuotationQuote } from '../types';

/** Extension points for WhatsApp, CRM, payments, and appointment booking. */
export interface EnquiryIntegrationHooks {
  onEnquiryCreated?: (quote: QuotationQuote) => Promise<void>;
  onStatusChanged?: (quote: QuotationQuote, previousStatus: string) => Promise<void>;
  onMeetingScheduled?: (quote: QuotationQuote, slot: string) => Promise<void>;
}

export interface WhatsAppMessagePayload {
  phone: string;
  template: string;
  variables: Record<string, string>;
}

export interface CrmLeadPayload {
  externalId: string;
  name: string;
  phone: string;
  email?: string;
  city: string;
  budget: string;
  source: string;
  notes?: string;
}

export interface PaymentLinkPayload {
  quoteId: string;
  amount: number;
  description: string;
}

export interface AppointmentSlot {
  date: string;
  time: string;
  type: 'site_visit' | 'design_consultation';
}
