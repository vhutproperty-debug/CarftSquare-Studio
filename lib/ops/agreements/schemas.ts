import { z } from 'zod';
import { AGREEMENT_STATUSES, AGREEMENT_TYPES } from '@/lib/ops/agreements/statuses';

export const patchAgreementRecordSchema = z.object({
  status: z.enum(AGREEMENT_STATUSES as unknown as [string, ...string[]]).optional(),
  agreementType: z.enum(AGREEMENT_TYPES as unknown as [string, ...string[]]).optional(),
  scheduledDate: z.string().trim().optional().or(z.literal('')),
  signedDate: z.string().trim().optional().or(z.literal('')),
  expiryDate: z.string().trim().optional().or(z.literal('')),
  agreementValue: z.string().trim().max(40).optional(),
  documentsComplete: z.boolean().optional(),
  renewalDueDate: z.string().trim().optional().or(z.literal('')),
  notes: z.string().trim().max(4000).optional(),
});

export const agreementQueueQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(25),
  search: z.string().trim().optional(),
  status: z.enum(AGREEMENT_STATUSES as unknown as [string, ...string[]]).optional(),
  expiringOnly: z.coerce.boolean().optional(),
  broker: z.string().trim().optional(),
});
