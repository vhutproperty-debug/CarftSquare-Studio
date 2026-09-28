export type CreativeGenerateInput = {
  offer: string;
  audienceHint?: string;
  areas?: string[];
  count?: number;
};

type GeneratedCreative = {
  offer: string;
  audienceHint: string;
  areas: string[];
  primaryText: string;
  headline: string;
  description: string;
  cta: string;
  angle: string;
};

const ANGLES = [
  {
    angle: 'availability_check',
    headline: 'Is your flat available?',
    cta: 'LEARN_MORE',
    build: (offer: string, area: string) =>
      `Hi, checking if your apartment${area ? ` in ${area}` : ''} is available for rent or resale. ${offer} Reply with interest and our team will assist.`,
  },
  {
    angle: 'free_consultation',
    headline: 'Free interior consult',
    cta: 'SIGN_UP',
    build: (offer: string, area: string) =>
      `${offer}${area ? ` for homes in ${area}` : ''}. Get a free consultation from CraftSquare Properties. Share your details — no obligation.`,
  },
  {
    angle: 'owner_direct',
    headline: 'Owners: get matched faster',
    cta: 'LEARN_MORE',
    build: (offer: string, area: string) =>
      `Property owners${area ? ` in ${area}` : ''}: ${offer}. CraftSquare helps with rent/resale enquiries professionally. Leave your number for a callback.`,
  },
  {
    angle: 'urgency_soft',
    headline: 'Serious buyers & tenants',
    cta: 'SIGN_UP',
    build: (offer: string, area: string) =>
      `We have active demand${area ? ` around ${area}` : ''}. ${offer} If you're open to rent or resale, share your WhatsApp number.`,
  },
  {
    angle: 'trust_local',
    headline: 'CraftSquare Properties',
    cta: 'LEARN_MORE',
    build: (offer: string, area: string) =>
      `CraftSquare Properties — Mumbai specialists. ${offer}${area ? ` Focus: ${area}.` : ''} Tell us if your apartment is available.`,
  },
] as const;

/**
 * Deterministic creative pack for dry-run (no spend, no external AI required).
 * Optional OpenAI enrichment can be added later without changing the Ops flow.
 */
export function generateCreativePack(input: CreativeGenerateInput): GeneratedCreative[] {
  const offer = input.offer.trim() || 'Checking rent or resale availability';
  const audienceHint = (input.audienceHint || 'Homeowners').trim();
  const areas = (input.areas?.length ? input.areas : ['Mumbai']).map((a) => a.trim()).filter(Boolean);
  const areaLabel = areas.slice(0, 2).join(' / ');
  const count = Math.min(Math.max(input.count || 5, 1), 8);

  return ANGLES.slice(0, count).map((row) => ({
    offer,
    audienceHint,
    areas,
    primaryText: row.build(offer, areaLabel),
    headline: row.headline.slice(0, 40),
    description: `${audienceHint} · ${areaLabel}`.slice(0, 30),
    cta: row.cta,
    angle: row.angle,
  }));
}
