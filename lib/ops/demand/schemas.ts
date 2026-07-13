import { z } from 'zod';
import { DEMAND_PRIORITIES, DEMAND_STATUSES } from '@/lib/ops/demand/statuses';
import { OPS_LEAD_SOURCES } from '@/lib/ops/leads/types';

export const demandQualificationSchema = z.object({
  rentBuy: z.enum(['rent', 'buy', 'unknown']).optional(),
  budget: z.string().trim().max(120).optional(),
  bhk: z.string().trim().max(40).optional(),
  furnishing: z.string().trim().max(80).optional(),
  preferredBuildings: z.string().trim().max(500).optional(),
  possessionTimeline: z.string().trim().max(120).optional(),
  familyOrBachelor: z.string().trim().max(80).optional(),
  company: z.string().trim().max(200).optional(),
  parkingRequirement: z.string().trim().max(120).optional(),
  pets: z.string().trim().max(80).optional(),
  notes: z.string().trim().max(4000).optional(),
});

export const patchDemandRecordSchema = z.object({
  status: z.enum(DEMAND_STATUSES as unknown as [string, ...string[]]).optional(),
  priority: z.enum(DEMAND_PRIORITIES as unknown as [string, ...string[]]).optional(),
  assignedTo: z.string().trim().max(120).optional().or(z.literal('')),
  internalNotes: z.string().trim().max(4000).optional(),
  qualification: demandQualificationSchema.optional(),
  nextFollowUpAt: z.string().min(1).optional().or(z.literal('')),
  followUpCompleted: z.boolean().optional(),
  lostReason: z.string().trim().max(500).optional(),
});

export const demandQueueQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(25),
  source: z.enum(OPS_LEAD_SOURCES as unknown as [string, ...string[]]).optional(),
  category: z.string().trim().optional(),
  search: z.string().trim().optional(),
  dateFrom: z.string().trim().optional(),
  dateTo: z.string().trim().optional(),
  status: z.enum(DEMAND_STATUSES as unknown as [string, ...string[]]).optional(),
  priority: z.enum(DEMAND_PRIORITIES as unknown as [string, ...string[]]).optional(),
  assignedTo: z.string().trim().optional(),
  mineOnly: z.coerce.boolean().optional(),
  rentBuy: z.enum(['rent', 'buy']).optional(),
  project: z.string().trim().optional(),
  building: z.string().trim().optional(),
  followUpToday: z.coerce.boolean().optional(),
  overdueOnly: z.coerce.boolean().optional(),
});

export const createDemandActivitySchema = z.object({
  type: z.enum([
    'CALL_LOGGED',
    'NOTE_ADDED',
    'FOLLOW_UP_SCHEDULED',
    'FOLLOW_UP_COMPLETED',
  ]),
  message: z.string().trim().min(1).max(2000),
  nextFollowUpAt: z.string().min(1).optional(),
});
