export type CreativeGenerateInput = {
  offer?: string;
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
    cta: 'LEARN_MORE',
    headline: (area: string) => `Is your ${area} flat free?`,
    build: (offer: string, area: string) =>
      `Checking availability${area ? ` in ${area}` : ''}. ${offer} Share your number and CraftSquare will call you back.`,
  },
  {
    angle: 'free_consultation',
    cta: 'SIGN_UP',
    headline: (area: string) => area ? `Free consult · ${area}` : 'Free interior consult',
    build: (offer: string, area: string) =>
      `${offer}${area ? ` for homes in ${area}` : ''}. Book a free CraftSquare consultation. No obligation.`,
  },
  {
    angle: 'owner_direct',
    cta: 'LEARN_MORE',
    headline: (area: string) => area ? `Owners in ${area}` : 'Owners: get matched',
    build: (offer: string, area: string) =>
      `Property owners${area ? ` near ${area}` : ''}: ${offer}. We handle rent and resale enquiries for you.`,
  },
  {
    angle: 'family_home',
    cta: 'SIGN_UP',
    headline: (area: string) => area ? `Family homes, ${area}` : 'A better family home',
    build: (offer: string, area: string) =>
      `Looking for a calmer family home${area ? ` around ${area}` : ''}? ${offer} Tell us the BHK and budget.`,
  },
  {
    angle: 'nri_callback',
    cta: 'CONTACT_US',
    headline: () => 'NRI callback this week',
    build: (offer: string, area: string) =>
      `Overseas and still managing a Mumbai flat${area ? ` in ${area}` : ''}? ${offer} We coordinate viewings in IST.`,
  },
  {
    angle: 'site_visit',
    cta: 'LEARN_MORE',
    headline: (area: string) => area ? `Visit homes in ${area}` : 'Book a site visit',
    build: (offer: string, area: string) =>
      `This week's site visits${area ? ` — ${area}` : ''}. ${offer} Pick a slot and we will confirm on WhatsApp.`,
  },
  {
    angle: 'resale_price',
    cta: 'SIGN_UP',
    headline: (area: string) => area ? `${area} resale check` : 'What is it worth?',
    build: (offer: string, area: string) =>
      `Want a straight resale read${area ? ` for ${area}` : ''}? ${offer} We compare recent deals before you list.`,
  },
  {
    angle: 'rental_yield',
    cta: 'LEARN_MORE',
    headline: (area: string) => area ? `Rent demand in ${area}` : 'Tenants are asking',
    build: (offer: string, area: string) =>
      `Active tenant demand${area ? ` in ${area}` : ''}. ${offer} If the flat is vacant, leave a WhatsApp number.`,
  },
] as const;

function tokens(value: string): Set<string> {
  return new Set(value.toLowerCase().split(/\W+/).filter((word) => word.length > 2));
}

function jaccard(a: string, b: string): number {
  const left = tokens(a);
  const right = tokens(b);
  if (!left.size || !right.size) return 0;
  let shared = 0;
  for (const word of left) if (right.has(word)) shared += 1;
  return shared / (left.size + right.size - shared);
}

function clip(value: string, max: number) {
  const clean = value.replace(/\s+/g, ' ').trim();
  return clean.length <= max ? clean : `${clean.slice(0, max - 1).trim()}…`;
}

/**
 * Varied creative pack for paused lead campaigns.
 * Near-duplicate headlines and primary text are dropped.
 */
export function generateCreativePack(input: CreativeGenerateInput): GeneratedCreative[] {
  const offer = (input.offer || '').trim() || 'Checking rent or resale availability';
  const audienceHint = (input.audienceHint || 'Homeowners').trim();
  const areas = (input.areas?.length ? input.areas : ['Mumbai']).map((area) => area.trim()).filter(Boolean);
  const count = Math.min(Math.max(input.count || 5, 1), ANGLES.length);
  const accepted: GeneratedCreative[] = [];

  for (let index = 0; index < ANGLES.length && accepted.length < count; index += 1) {
    const row = ANGLES[index];
    const area = areas[index % areas.length] || 'Mumbai';
    const headline = clip(row.headline(area), 40);
    const primaryText = clip(row.build(offer, area), 280);
    const duplicate = accepted.some((item) =>
      item.headline.toLowerCase() === headline.toLowerCase()
      || jaccard(item.primaryText, primaryText) > 0.82,
    );
    if (duplicate) continue;
    accepted.push({
      offer,
      audienceHint,
      areas,
      primaryText,
      headline,
      description: clip(`${audienceHint} · ${area}`, 30),
      cta: row.cta,
      angle: row.angle,
    });
  }

  return accepted;
}
