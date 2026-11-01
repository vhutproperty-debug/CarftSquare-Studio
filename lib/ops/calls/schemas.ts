import { z } from 'zod';
import { CALL_ACTIVITY_STATUSES } from '@/lib/ops/calls/statuses';
import { normalizeOutreachPhone } from '@/lib/ops/outreach-phone';
import { OPS_LEAD_SOURCES } from '@/lib/ops/leads/types';

const phoneSchema = z.string().trim().min(8).max(20).refine(
  (value) => normalizeOutreachPhone(value) != null,
  { message: 'Enter a valid Indian mobile or international number in E.164 format.' },
);

export const prospectPrioritySchema = z.enum(['P1', 'P2', 'P3', 'P4', 'Intl']);
export const prospectIntentSchema = z.enum(['sell', 'rent', 'interiors', 'not_now']);

const optionalOutreachPhone = z.string().trim().max(20).optional().or(z.literal('')).refine(
  (value) => !value || normalizeOutreachPhone(value) != null,
  { message: 'Enter a valid Indian mobile or international number in E.164 format.' },
);

export const createCallActivitySchema = z.object({
  targetType: z.enum(['unified_lead', 'ops_prospect']),
  targetSource: z.enum(OPS_LEAD_SOURCES as unknown as [string, ...string[]]).optional(),
  targetId: z.string().trim().min(1).max(120),
  phone: phoneSchema,
  status: z.enum(CALL_ACTIVITY_STATUSES as unknown as [string, ...string[]]),
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
  alternatePhone: optionalOutreachPhone,
  email: z.string().trim().email().max(254).optional().or(z.literal('')),
  prospectType: prospectTypeSchema.default('unknown'),
  projectName: z.string().trim().max(200).optional(),
  building: z.string().trim().max(200).optional(),
  unit: z.string().trim().max(200).optional(),
  location: z.string().trim().max(200).optional(),
  requirement: z.string().trim().max(2000).optional(),
  notes: z.string().trim().max(4000).optional(),
  source: prospectSourceSchema.default('manual'),
  assignedTo: z.string().trim().max(120).optional(),
  priority: prospectPrioritySchema.optional(),
  wave: z.number().int().min(1).max(99).optional(),
  batch: z.string().trim().max(80).optional(),
  campaignTag: z.string().trim().max(120).optional(),
  unitCount: z.number().int().min(0).max(99).optional(),
  salutation: z.string().trim().max(80).optional(),
});

export const updateProspectSchema = z.object({
  name: z.string().trim().max(120).optional(),
  alternatePhone: optionalOutreachPhone,
  email: z.string().trim().email().max(254).optional().or(z.literal('')),
  prospectType: prospectTypeSchema.optional(),
  projectName: z.string().trim().max(200).optional(),
  building: z.string().trim().max(200).optional(),
  unit: z.string().trim().max(200).optional(),
  location: z.string().trim().max(200).optional(),
  requirement: z.string().trim().max(2000).optional(),
  notes: z.string().trim().max(4000).optional(),
  assignedTo: z.string().trim().max(120).optional().or(z.literal('')),
  priority: prospectPrioritySchema.optional(),
  wave: z.number().int().min(1).max(99).optional(),
  batch: z.string().trim().max(80).optional().or(z.literal('')),
  campaignTag: z.string().trim().max(120).optional().or(z.literal('')),
  unitCount: z.number().int().min(0).max(99).optional(),
  salutation: z.string().trim().max(80).optional().or(z.literal('')),
  optOut: z.boolean().optional(),
  doNotContact: z.boolean().optional(),
  lastButtonReply: z.string().trim().max(120).optional().or(z.literal('')),
  intent: prospectIntentSchema.optional(),
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
  priority: prospectPrioritySchema.optional(),
  wave: z.coerce.number().int().min(1).max(99).optional(),
  batch: z.string().trim().max(80).optional(),
  campaignTag: z.string().trim().max(120).optional(),
  intent: prospectIntentSchema.optional(),
  hideOptOut: z.coerce.boolean().optional(),
});

export function normalizeProspectPhone(value: string): string {
  return normalizeOutreachPhone(value)?.phone || '';
}
