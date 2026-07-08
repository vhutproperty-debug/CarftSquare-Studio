import { z } from 'zod';
import { SATELLITE_INTENTS, SATELLITE_LEAD_SOURCE, SATELLITE_POSSESSION_OPTIONS } from './constants';

const intentIds = SATELLITE_INTENTS.map((intent) => intent.id) as [string, ...string[]];
const possessionIds = SATELLITE_POSSESSION_OPTIONS.map((option) => option.id) as [string, ...string[]];

const utmSchema = z
  .object({
    utmSource: z.string().trim().max(120).optional(),
    utmMedium: z.string().trim().max(120).optional(),
    utmCampaign: z.string().trim().max(120).optional(),
    utmTerm: z.string().trim().max(120).optional(),
    utmContent: z.string().trim().max(120).optional(),
  })
  .optional();

export const satelliteEleganceLeadSubmitSchema = z.object({
  name: z.string().trim().max(80).optional(),
  mobile: z.string().trim().max(20).optional(),
  selectedIntent: z.enum(intentIds),
  possessionTimeline: z.enum(possessionIds),
  pagePath: z.string().trim().max(200).optional(),
  referrer: z.string().trim().max(500).optional(),
  utm: utmSchema,
  source: z.literal(SATELLITE_LEAD_SOURCE).optional(),
});

export type SatelliteEleganceLeadSubmitInput = z.infer<typeof satelliteEleganceLeadSubmitSchema>;
