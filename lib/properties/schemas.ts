import { z } from 'zod';
import { PROPERTIES_CONSENT_VERSION, PROPERTIES_INTENTS } from './constants';

const intentIds = PROPERTIES_INTENTS.map((intent) => intent.id) as [string, ...string[]];

const utmSchema = z
  .object({
    utmSource: z.string().trim().max(120).optional(),
    utmMedium: z.string().trim().max(120).optional(),
    utmCampaign: z.string().trim().max(120).optional(),
    utmTerm: z.string().trim().max(120).optional(),
    utmContent: z.string().trim().max(120).optional(),
  })
  .optional();

export const propertiesLeadSubmitSchema = z.object({
  name: z.string().trim().min(2, 'Please enter your name.').max(80),
  mobile: z.string().trim().min(10, 'Please enter a valid 10-digit mobile number.').max(20),
  email: z
    .string()
    .trim()
    .max(120)
    .optional()
    .refine((value) => !value || z.string().email().safeParse(value).success, 'Please enter a valid email address.'),
  intent: z.enum(intentIds, { errorMap: () => ({ message: 'Please choose what you want to do.' }) }),
  area: z.string().trim().max(120).optional(),
  budget: z.string().trim().max(80).optional(),
  message: z.string().trim().max(1000).optional(),
  consent: z.literal(true, { errorMap: () => ({ message: 'Please tick the consent box to continue.' }) }),
  consentVersion: z.literal(PROPERTIES_CONSENT_VERSION).optional(),
  pagePath: z.string().trim().max(200).optional(),
  referrer: z.string().trim().max(500).optional(),
  utm: utmSchema,
  /** Honeypot. Real visitors never see or fill this field. */
  companyWebsite: z.string().max(200).optional(),
});

export type PropertiesLeadSubmitInput = z.infer<typeof propertiesLeadSubmitSchema>;
