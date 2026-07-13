import { z } from 'zod';
import { DEAL_PAYMENT_STATUSES, DEAL_STAGES, DEAL_TRANSACTION_TYPES } from '@/lib/ops/deals/statuses';

const documentsSchema = z.object({
  clientKyc: z.boolean().optional(),
  ownerKyc: z.boolean().optional(),
  draftAgreement: z.boolean().optional(),
  signedAgreement: z.boolean().optional(),
  tokenReceipt: z.boolean().optional(),
  commissionInvoice: z.boolean().optional(),
  noc: z.boolean().optional(),
  societyNoc: z.boolean().optional(),
});

export const createDealSchema = z.object({
  matchId: z.string().trim().min(1),
});

const dealFieldsSchema = z.object({
  broker: z.string().trim().max(120).optional().or(z.literal('')),
  clientName: z.string().trim().max(200).optional(),
  ownerName: z.string().trim().max(200).optional(),
  project: z.string().trim().max(200).optional(),
  building: z.string().trim().max(200).optional(),
  flat: z.string().trim().max(80).optional(),
  transactionType: z.enum(DEAL_TRANSACTION_TYPES as unknown as [string, ...string[]]).optional(),
  expectedRent: z.string().trim().max(40).optional(),
  expectedSaleValue: z.string().trim().max(40).optional(),
  expectedBrokerage: z.string().trim().max(40).optional(),
  interiorOpportunity: z.boolean().optional(),
  stage: z.enum(DEAL_STAGES as unknown as [string, ...string[]]).optional(),
  probability: z.coerce.number().min(0).max(100).optional(),
  targetClosingDate: z.string().trim().optional().or(z.literal('')),
  siteVisitDate: z.string().trim().optional().or(z.literal('')),
  offerAmount: z.string().trim().max(40).optional(),
  negotiationNotes: z.string().trim().max(4000).optional(),
  documentsChecklist: documentsSchema.optional(),
  agreementDate: z.string().trim().optional().or(z.literal('')),
  agreementValue: z.string().trim().max(40).optional(),
  actualBrokerage: z.string().trim().max(40).optional(),
  paymentStatus: z.enum(DEAL_PAYMENT_STATUSES as unknown as [string, ...string[]]).optional(),
  commissionCollected: z.string().trim().max(40).optional(),
  lostReason: z.string().trim().max(500).optional(),
  internalNotes: z.string().trim().max(4000).optional(),
});

export const patchDealRecordSchema = dealFieldsSchema;

export const dealQueueQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(25),
  search: z.string().trim().optional(),
  project: z.string().trim().optional(),
  broker: z.string().trim().optional(),
  stage: z.enum(DEAL_STAGES as unknown as [string, ...string[]]).optional(),
  transactionType: z.enum(DEAL_TRANSACTION_TYPES as unknown as [string, ...string[]]).optional(),
  minProbability: z.coerce.number().min(0).max(100).optional(),
  paymentStatus: z.enum(DEAL_PAYMENT_STATUSES as unknown as [string, ...string[]]).optional(),
  dateFrom: z.string().trim().optional(),
  dateTo: z.string().trim().optional(),
  mineOnly: z.coerce.boolean().optional(),
  activeOnly: z.coerce.boolean().optional(),
});

export const createDealActivitySchema = z.object({
  type: z.enum([
    'NOTE_ADDED',
    'SITE_VISIT_SCHEDULED',
    'SITE_VISIT_COMPLETED',
    'TOKEN_RECEIVED',
    'AGREEMENT_COMPLETED',
    'COMMISSION_RECEIVED',
    'LOST',
  ]),
  message: z.string().trim().min(1).max(2000),
  siteVisitDate: z.string().min(1).optional(),
});
