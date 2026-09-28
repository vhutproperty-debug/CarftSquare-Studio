import { z } from 'zod';
import { META_CAPI_PROXY_EVENTS } from './types';

const metaUserDataSchema = z
  .object({
    email: z.string().max(200).optional(),
    phone: z.string().max(30).optional(),
    firstName: z.string().max(80).optional(),
    lastName: z.string().max(80).optional(),
    city: z.string().max(80).optional(),
    state: z.string().max(80).optional(),
    zip: z.string().max(20).optional(),
    externalId: z.string().max(120).optional(),
    fbp: z.string().max(200).optional(),
    fbc: z.string().max(200).optional(),
  })
  .strict()
  .optional();

export const metaCapiRequestSchema = z.object({
  eventName: z.enum(META_CAPI_PROXY_EVENTS),
  eventId: z.string().uuid(),
  eventSourceUrl: z.string().url().max(500),
  customData: z.record(z.unknown()).optional().default({}),
  userData: metaUserDataSchema,
});
