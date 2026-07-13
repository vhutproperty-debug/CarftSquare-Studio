import { z } from 'zod';
import { MATCH_STATUSES } from '@/lib/ops/matching/statuses';

export const patchMatchRecordSchema = z.object({
  status: z.enum(MATCH_STATUSES as unknown as [string, ...string[]]).optional(),
  broker: z.string().trim().max(120).optional().or(z.literal('')),
  notes: z.string().trim().max(4000).optional(),
  siteVisitAt: z.string().min(1).optional().or(z.literal('')),
});

export const matchingQueueQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(25),
  search: z.string().trim().optional(),
  project: z.string().trim().optional(),
  broker: z.string().trim().optional(),
  configuration: z.string().trim().optional(),
  listingType: z.enum(['rent', 'sale']).optional(),
  minScore: z.coerce.number().min(0).max(100).optional(),
  status: z.enum(MATCH_STATUSES as unknown as [string, ...string[]]).optional(),
  assignedBroker: z.string().trim().optional(),
  dateFrom: z.string().trim().optional(),
  dateTo: z.string().trim().optional(),
  mineOnly: z.coerce.boolean().optional(),
});

export const generateMatchesSchema = z.object({
  minScore: z.coerce.number().min(0).max(100).optional().default(35),
  demandKey: z.string().trim().optional(),
  supplyId: z.string().trim().optional(),
});

export const createMatchActivitySchema = z.object({
  type: z.enum([
    'NOTE_ADDED',
    'OWNER_CONTACTED',
    'CLIENT_SHARED',
    'SITE_VISIT_SCHEDULED',
  ]),
  message: z.string().trim().min(1).max(2000),
  siteVisitAt: z.string().min(1).optional(),
});
