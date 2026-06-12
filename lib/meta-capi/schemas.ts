import { z } from 'zod';

export const metaCapiRequestSchema = z.object({
  eventName: z.enum(['PageView', 'ViewContent', 'Lead', 'Contact', 'Schedule']),
  eventId: z.string().uuid(),
  eventSourceUrl: z.string().url().max(500),
  customData: z.record(z.unknown()).optional().default({}),
  userData: z
    .object({
      email: z.string().max(200).optional(),
      phone: z.string().max(30).optional(),
      firstName: z.string().max(80).optional(),
      lastName: z.string().max(80).optional(),
      fbp: z.string().max(200).optional(),
      fbc: z.string().max(200).optional(),
    })
    .optional(),
});
