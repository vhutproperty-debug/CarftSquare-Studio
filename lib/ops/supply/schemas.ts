import { z } from 'zod';
import { SUPPLY_PRIORITIES, SUPPLY_SOURCES, SUPPLY_STATUSES } from '@/lib/ops/supply/statuses';

const supplyFieldsSchema = z.object({
  propertyType: z.string().trim().max(80).optional(),
  listingType: z.enum(['rent', 'sale']).optional(),
  project: z.string().trim().max(200).optional(),
  building: z.string().trim().max(200).optional(),
  wing: z.string().trim().max(40).optional(),
  flatNumber: z.string().trim().max(40).optional(),
  configuration: z.string().trim().max(40).optional(),
  carpetArea: z.string().trim().max(40).optional(),
  floor: z.string().trim().max(40).optional(),
  facing: z.string().trim().max(80).optional(),
  parking: z.string().trim().max(80).optional(),
  ownerName: z.string().trim().max(200).optional(),
  ownerMobile: z.string().trim().max(20).optional(),
  ownerEmail: z.string().trim().max(200).optional(),
  source: z.enum(SUPPLY_SOURCES as unknown as [string, ...string[]]).optional(),
  exclusive: z.boolean().optional(),
  availableFrom: z.string().trim().optional().or(z.literal('')),
  expectedRent: z.string().trim().max(40).optional(),
  expectedDeposit: z.string().trim().max(40).optional(),
  expectedSalePrice: z.string().trim().max(40).optional(),
  brokeragePercent: z.string().trim().max(20).optional(),
  furnishedStatus: z.string().trim().max(80).optional(),
  keysAvailable: z.boolean().optional(),
  tenantOccupied: z.boolean().optional(),
  agreementExpiry: z.string().trim().optional().or(z.literal('')),
  possessionStatus: z.string().trim().max(120).optional(),
  lastContactAt: z.string().trim().optional().or(z.literal('')),
  assignedBroker: z.string().trim().max(120).optional().or(z.literal('')),
  priority: z.enum(SUPPLY_PRIORITIES as unknown as [string, ...string[]]).optional(),
  status: z.enum(SUPPLY_STATUSES as unknown as [string, ...string[]]).optional(),
  availabilityStatus: z.string().trim().max(120).optional(),
  readyForMatching: z.boolean().optional(),
  internalNotes: z.string().trim().max(4000).optional(),
  nextFollowUpAt: z.string().min(1).optional().or(z.literal('')),
  followUpCompleted: z.boolean().optional(),
  prospectId: z.string().trim().max(120).optional(),
});

export const createSupplyRecordSchema = supplyFieldsSchema.extend({
  source: z.enum(SUPPLY_SOURCES as unknown as [string, ...string[]]).default('manual_inventory'),
  listingType: z.enum(['rent', 'sale']).optional(),
});

export const patchSupplyRecordSchema = supplyFieldsSchema;

export const supplyQueueQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(25),
  search: z.string().trim().optional(),
  sort: z.enum(['updatedAt', 'createdAt', 'project', 'building', 'agreementExpiry', 'priority']).optional().default('updatedAt'),
  sortDir: z.enum(['asc', 'desc']).optional().default('desc'),
  project: z.string().trim().optional(),
  building: z.string().trim().optional(),
  configuration: z.string().trim().optional(),
  listingType: z.enum(['rent', 'sale']).optional(),
  assignedBroker: z.string().trim().optional(),
  availabilityStatus: z.string().trim().optional(),
  exclusive: z.coerce.boolean().optional(),
  keysAvailable: z.coerce.boolean().optional(),
  agreementExpiring: z.coerce.boolean().optional(),
  readyForMatching: z.coerce.boolean().optional(),
  status: z.enum(SUPPLY_STATUSES as unknown as [string, ...string[]]).optional(),
  priority: z.enum(SUPPLY_PRIORITIES as unknown as [string, ...string[]]).optional(),
  mineOnly: z.coerce.boolean().optional(),
  followUpToday: z.coerce.boolean().optional(),
  overdueOnly: z.coerce.boolean().optional(),
});

export const createSupplyActivitySchema = z.object({
  type: z.enum([
    'OWNER_CALLED',
    'NOTE_ADDED',
    'FOLLOW_UP_SCHEDULED',
    'FOLLOW_UP_COMPLETED',
    'VERIFIED',
  ]),
  message: z.string().trim().min(1).max(2000),
  nextFollowUpAt: z.string().min(1).optional(),
});
