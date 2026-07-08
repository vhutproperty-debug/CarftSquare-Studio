import { BRAND } from '@/lib/brand';

export const SATELLITE_LANDING_PATH = '/satellite-elegance';

/** Tower render: public/images/satellite-elegance/satellite-elegance-tower.webp */
export const SATELLITE_TOWER_IMAGE = '/images/satellite-elegance/satellite-elegance-tower.webp';

export const SATELLITE_LEAD_SOURCE = 'satellite_elegance';

export const SATELLITE_BOT_DISMISSED_KEY = 'satellite_elegance_bot_dismissed';

export const SATELLITE_WHATSAPP_NUMBER = BRAND.whatsappNumber;

export const SATELLITE_INTENTS = [
  {
    id: 'complete_home_interiors',
    label: 'Complete Home Interiors',
    subtext: 'End-to-end design and execution for your Satellite Elegance home',
  },
  {
    id: 'kitchen_wardrobes_storage',
    label: 'Kitchen, Wardrobes & Storage',
    subtext: 'Modular kitchen, wardrobes and smart storage before you move in',
  },
  {
    id: 'free_design_consultation',
    label: 'Free Design Consultation',
    subtext: 'Free site visit and measurement for your actual home layout',
  },
] as const;

export type SatelliteIntentId = (typeof SATELLITE_INTENTS)[number]['id'];

export const SATELLITE_POSSESSION_OPTIONS = [
  { id: 'already_received', label: 'Already received possession' },
  { id: 'within_1_month', label: 'Within 1 month' },
  { id: '1_3_months', label: '1–3 months' },
  { id: 'later', label: 'Later' },
] as const;

export type SatellitePossessionId = (typeof SATELLITE_POSSESSION_OPTIONS)[number]['id'];

export function getPossessionLabel(id: string): string {
  return SATELLITE_POSSESSION_OPTIONS.find((option) => option.id === id)?.label || id;
}

export function getIntentLabel(id: string): string {
  return SATELLITE_INTENTS.find((intent) => intent.id === id)?.label || id;
}

export const SATELLITE_WHATSAPP_URL =
  `https://wa.me/${SATELLITE_WHATSAPP_NUMBER}?text=${encodeURIComponent('Hi, I am a Satellite Elegance homeowner and would like to discuss interiors for my home.')}`;
