import { z } from 'zod';
import { CALL_ACTIVITY_STATUSES } from '@/lib/ops/calls/statuses';
import { isValidIndianMobile, normalizeIndianMobile } from '@/lib/phone/indian-mobile';
import { OPS_LEAD_SOURCES } from '@/lib/ops/leads/types';

const phoneSchema = z.string().trim().min(10).max(20).refine(
  (value) => isValidIndianMobile(value),
  { message: 'Please enter a valid 10-digit mobile number.' },
);

export const createCallActivitySchema = z.object({
  targetType: z.enum(['unified_lead', 'ops_prospect']),
  targetSource: z.enum(OPS_LEAD_SOURCES as [string, ...string[]]).optional(),
  targetId: z.string().trim().min(1).max(120),
  phone: phoneSchema,
  status: z.enum(CALL_ACTIVITY_STATUSES as [string, ...string[]]),
  note: z.string().trim().max(2000).optional(),
  nextFollowUpAt: z.string().min(1).optional(),
  adminOverrideDoNotCall: z.boolean().optional(),
}).superRefine((data, ctx) => {
  if (data.targetType === 'unified_lead' && !data.targetSource) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'targetSource is required for unified leads.',
      path: ['targetSource'],
    });
  }
});

export const listCallActivitiesQuerySchema = z.object({
  targetType: z.enum(['unified_lead', 'ops_prospect']),
  targetSource: z.string().trim().optional(),
  targetId: z.string().trim().min(1),
});

export const prospectTypeSchema = z.enum([
  'homeowner',
  'rental_owner',
  'buyer',
  'tenant',
  'interior_prospect',
  'broker',
  'unknown',
]);

export const prospectSourceSchema = z.enum([
  'manual',
  'csv_import',
  'existing_database',
  'referral',
  'other',
]);

export const createProspectSchema = z.object({
  name: z.string().trim().max(120).optional(),
  phone: phoneSchema,
  alternatePhone: z.string().trim().max(20).optional().or(z.literal('')),
  email: z.string().trim().email().max(254).optional().or(z.literal('')),
  prospectType: prospectTypeSchema.default('unknown'),
  projectName: z.string().trim().max(200).optional(),
  building: z.string().trim().max(200).optional(),
  unit: z.string().trim().max(80).optional(),
  location: z.string().trim().max(200).optional(),
  requirement: z.string().trim().max(2000).optional(),
  notes: z.string().trim().max(4000).optional(),
  source: prospectSourceSchema.default('manual'),
  assignedTo: z.string().trim().max(120).optional(),
});

export const updateProspectSchema = z.object({
  name: z.string().trim().max(120).optional(),
  alternatePhone: z.string().trim().max(20).optional().or(z.literal('')),
  email: z.string().trim().email().max(254).optional().or(z.literal('')),
  prospectType: prospectTypeSchema.optional(),
  projectName: z.string().trim().max(200).optional(),
  building: z.string().trim().max(200).optional(),
  unit: z.string().trim().max(80).optional(),
  location: z.string().trim().max(200).optional(),
  requirement: z.string().trim().max(2000).optional(),
  notes: z.string().trim().max(4000).optional(),
  assignedTo: z.string().trim().max(120).optional().or(z.literal('')),
});

export const callQueueQuerySchema = z.object({
  section: z.enum([
    'all',
    'my_today',
    'follow_ups_due',
    'overdue',
    'not_called',
    'interested',
    'recently_called',
  ]).optional().default('all'),
  assignedTo: z.string().trim().optional(),
  project: z.string().trim().optional(),
  prospectType: prospectTypeSchema.optional(),
  callStatus: z.string().trim().optional(),
  search: z.string().trim().optional(),
  mineOnly: z.coerce.boolean().optional(),
});

export function normalizeProspectPhone(value: string): string {
  return normalizeIndianMobile(value);
}
