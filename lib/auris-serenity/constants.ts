import { BRAND } from '@/lib/brand';

export const AURIS_LANDING_PATH = '/auris-serenity';

/** Approved tower image: public/images/auris-serenity/auris-serenity-tower.jpg */
export const AURIS_TOWER_IMAGE = '/images/auris-serenity/auris-serenity-tower.jpg';

export const AURIS_LEAD_SOURCE = 'auris_serenity';

export const AURIS_BOT_DISMISSED_KEY = 'auris_serenity_bot_dismissed';

export const AURIS_WHATSAPP_NUMBER = BRAND.whatsappNumber;

export const AURIS_INTENTS = [
  {
    id: 'rental_apartment',
    label: 'Rent Out My Apartment',
    subtext: 'Get your Auris Serenity apartment rental-ready',
  },
  {
    id: 'ac_kitchen_basics',
    label: 'AC + Kitchen + Basics for Rental',
    subtext: 'Essentials before renting or moving in',
  },
  {
    id: 'full_home_furnishing',
    label: 'Full Home Furnishing',
    subtext: 'Complete interiors and furnishing',
  },
] as const;

export type AurisIntentId = (typeof AURIS_INTENTS)[number]['id'];

export const AURIS_POSSESSION_OPTIONS = [
  { id: 'already_received', label: 'Already received possession' },
  { id: 'within_1_month', label: 'Within 1 month' },
  { id: '1_3_months', label: '1–3 months' },
  { id: 'later', label: 'Later' },
] as const;

export type AurisPossessionId = (typeof AURIS_POSSESSION_OPTIONS)[number]['id'];

export function getPossessionLabel(id: string): string {
  return AURIS_POSSESSION_OPTIONS.find((option) => option.id === id)?.label || id;
}

export function getIntentLabel(id: string): string {
  return AURIS_INTENTS.find((intent) => intent.id === id)?.label || id;
}

export const AURIS_WHATSAPP_URL =
  `https://wa.me/${AURIS_WHATSAPP_NUMBER}?text=${encodeURIComponent('Hi CraftSquare Studio, I own an apartment in Auris Serenity and would like to discuss my requirements.')}`;
