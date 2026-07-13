import { z } from 'zod';
import { RENEWAL_STATUSES } from '@/lib/ops/renewals/statuses';

export const patchRenewalRecordSchema = z.object({
  status: z.enum(RENEWAL_STATUSES as unknown as [string, ...string[]]).optional(),
  notes: z.string().trim().max(4000).optional(),
});

export const renewalQueueQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(25),
  status: z.enum(RENEWAL_STATUSES as unknown as [string, ...string[]]).optional(),
});
