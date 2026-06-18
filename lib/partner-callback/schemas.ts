import { z } from 'zod';

export const partnerCallbackRequestSchema = z.object({
  name: z.string().max(120).optional().or(z.literal('')),
  mobile: z.string().min(10).max(15),
});
