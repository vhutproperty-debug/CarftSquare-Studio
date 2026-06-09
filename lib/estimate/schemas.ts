import { z } from 'zod';

const phoneSchema = z.string().trim().min(8).max(20).regex(/^[+\d\s()-]+$/);

export const estimateChatSchema = z.object({
  moduleId: z.enum([
    'home-interior',
    'rental-furnishing',
    'modular-kitchen',
    'wardrobe',
    'office-interior',
    'commercial-interior',
  ]),
  answers: z.record(z.union([z.string(), z.number(), z.boolean(), z.array(z.string())])).default({}),
  conversation: z
    .array(
      z.object({
        role: z.enum(['assistant', 'user']),
        content: z.string(),
        timestamp: z.string(),
      }),
    )
    .default([]),
  userMessage: z.string().trim().max(2000).optional(),
  phase: z.enum(['discovery', 'summary', 'lead', 'complete']).default('discovery'),
  leadSource: z.string().trim().max(80).optional(),
  campaignName: z.string().trim().max(80).optional(),
  landingPage: z.string().trim().max(200).optional(),
});

export const estimateLeadSchema = z.object({
  quoteId: z.string().uuid().optional(),
  moduleId: z.enum([
    'home-interior',
    'rental-furnishing',
    'modular-kitchen',
    'wardrobe',
    'office-interior',
    'commercial-interior',
  ]),
  name: z.string().trim().min(2).max(120),
  phone: phoneSchema,
  whatsapp: phoneSchema.optional(),
  email: z.string().trim().email().max(254).optional().or(z.literal('')),
  answers: z.record(z.union([z.string(), z.number(), z.boolean(), z.array(z.string())])),
  conversation: z.array(
    z.object({
      role: z.enum(['assistant', 'user']),
      content: z.string(),
      timestamp: z.string(),
    }),
  ),
  leadSource: z.string().trim().max(80).default('ai-estimate'),
  campaignName: z.string().trim().max(80).default(''),
  landingPage: z.string().trim().max(200).default('/estimate'),
});

export const estimateAdjustSchema = z.object({
  action: z.enum([
    'reduce_10',
    'reduce_20',
    'upgrade_premium',
    'upgrade_luxury',
    'maximize_storage',
    'luxury_aesthetics',
    'rental_friendly',
    'airbnb_ready',
  ]),
});

export const quotationPricingSaveSchema = z.object({
  moduleId: z.enum([
    'home-interior',
    'rental-furnishing',
    'modular-kitchen',
    'wardrobe',
    'office-interior',
    'commercial-interior',
  ]),
  config: z.record(z.any()),
});
