import { z } from 'zod';

export const brokerInventoryQueueQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  search: z.string().trim().max(200).optional(),
  project: z.string().trim().max(200).optional(),
  transactionType: z.enum(['RENT', 'SALE', 'UNKNOWN', 'all']).optional(),
  bhk: z.string().trim().max(20).optional(),
  freshness: z.enum(['FRESH', 'AGING', 'STALE', 'all']).optional(),
  broker: z.string().trim().max(200).optional(),
  group: z.string().trim().max(200).optional(),
  furnishing: z.enum(['FURNISHED', 'SEMI_FURNISHED', 'UNFURNISHED', 'UNKNOWN', 'all']).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'ARCHIVED', 'all']).optional(),
  minConfidence: z.coerce.number().min(0).max(100).optional(),
  maxConfidence: z.coerce.number().min(0).max(100).optional(),
  sort: z
    .enum([
      'lastSeenAt',
      'firstSeenAt',
      'occurrenceCount',
      'projectNormalized',
      'rent',
      'salePrice',
      'overallConfidence',
    ])
    .optional(),
  sortDir: z.enum(['asc', 'desc']).optional(),
});

export const brokerImportMetaSchema = z.object({
  groupName: z.string().trim().min(1).max(200),
  resumeBatchId: z.string().trim().max(80).optional(),
});

export const brokerBatchesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

export const brokerMatchQuerySchema = z.object({
  demandKey: z.string().trim().min(1).max(300).optional(),
  demandSource: z.string().trim().max(80).optional(),
  demandSourceId: z.string().trim().max(200).optional(),
  inventoryId: z.string().trim().max(80).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const brokerReviewQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(25),
  status: z.enum(['PENDING', 'APPROVED_MERGE', 'CREATED_NEW', 'IGNORED', 'all']).optional(),
  batchId: z.string().trim().max(80).optional(),
});

export const brokerReviewActionSchema = z.object({
  action: z.enum(['approve_merge', 'create_new', 'ignore']),
});

export const brokerDirectoryQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(25),
  search: z.string().trim().max(200).optional(),
});

export const projectAliasCreateSchema = z.object({
  canonicalProject: z.string().trim().min(1).max(200),
  aliases: z.array(z.string().trim().min(1).max(200)).default([]),
  city: z.string().trim().max(100).optional(),
  locality: z.string().trim().max(100).optional(),
  builder: z.string().trim().max(100).optional(),
  active: z.boolean().optional(),
});

export const projectAliasPatchSchema = projectAliasCreateSchema.partial();

export type BrokerInventoryQueueQuery = z.infer<typeof brokerInventoryQueueQuerySchema>;
