import { z } from 'zod';
import { REVENUE_STATUSES, REVENUE_STREAM_TYPES } from '@/lib/ops/revenue/statuses';

export const patchRevenueRecordSchema = z.object({
  expectedAmount: z.coerce.number().min(0).optional(),
  invoicedAmount: z.coerce.number().min(0).optional(),
  collectedAmount: z.coerce.number().min(0).optional(),
  status: z.enum(REVENUE_STATUSES as unknown as [string, ...string[]]).optional(),
  dueDate: z.string().trim().optional().or(z.literal('')),
  collectedAt: z.string().trim().optional().or(z.literal('')),
  interiorReferral: z.boolean().optional(),
  notes: z.string().trim().max(4000).optional(),
});

export const revenueQueueQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(25),
  search: z.string().trim().optional(),
  status: z.enum(REVENUE_STATUSES as unknown as [string, ...string[]]).optional(),
  broker: z.string().trim().optional(),
  streamType: z.enum(REVENUE_STREAM_TYPES as unknown as [string, ...string[]]).optional(),
  overdueOnly: z.coerce.boolean().optional(),
  mineOnly: z.coerce.boolean().optional(),
});
