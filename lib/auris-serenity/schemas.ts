import { z } from 'zod';
import { AURIS_INTENTS, AURIS_LEAD_SOURCE, AURIS_POSSESSION_OPTIONS } from './constants';

const intentIds = AURIS_INTENTS.map((intent) => intent.id) as [string, ...string[]];
const possessionIds = AURIS_POSSESSION_OPTIONS.map((option) => option.id) as [string, ...string[]];

const utmSchema = z
  .object({
    utmSource: z.string().trim().max(120).optional(),
    utmMedium: z.string().trim().max(120).optional(),
    utmCampaign: z.string().trim().max(120).optional(),
    utmTerm: z.string().trim().max(120).optional(),
    utmContent: z.string().trim().max(120).optional(),
  })
  .optional();

export const aurisSerenityLeadSubmitSchema = z.object({
  name: z.string().trim().min(2).max(80),
  mobile: z.string().trim().min(8).max(20).regex(/^[+\d\s()-]+$/),
  selectedIntent: z.enum(intentIds),
  possessionTimeline: z.enum(possessionIds),
  pagePath: z.string().trim().max(200).optional(),
  referrer: z.string().trim().max(500).optional(),
  utm: utmSchema,
  source: z.literal(AURIS_LEAD_SOURCE).optional(),
});

export type AurisSerenityLeadSubmitInput = z.infer<typeof aurisSerenityLeadSubmitSchema>;
