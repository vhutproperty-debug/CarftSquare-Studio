import { z } from 'zod';

const phoneSchema = z.string().trim().min(8).max(20).regex(/^[+\d\s()-]+$/);

export const designerCallbackSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(120),
  phone: phoneSchema,
  city: z.string().trim().max(80).optional().default(''),
  projectType: z
    .enum(['Home', 'Office', 'Commercial', 'Rental Property', 'Other', ''])
    .optional()
    .default(''),
  message: z.string().trim().max(1000).optional().default(''),
  landingPage: z.string().trim().max(200).optional().default('/'),
});

export const designerLeadUpdateSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(['new', 'contacted', 'meeting_scheduled', 'won', 'lost']).optional(),
  notes: z.string().trim().max(2000).optional(),
});
