/** CraftSquare Properties: public brokerage page and opt-in lead form. */
export const PROPERTIES_PAGE_PATH = '/properties';
export const PROPERTIES_LEADS_COLLECTION = 'properties_leads';
/** Stored on each lead document. */
export const PROPERTIES_LEAD_SOURCE = 'website';
/** Unified ops leads source key (used in /ops/leads/<source>/<id> links). */
export const PROPERTIES_OPS_SOURCE = 'properties';

export const PROPERTIES_BRAND_NAME = 'CraftSquare Properties';
export const PROPERTIES_CONTACT_NAME = 'Arun Pandey';
export const PROPERTIES_PHONE_DISPLAY = '90224 04260';
export const PROPERTIES_PHONE_E164 = '+919022404260';
export const PROPERTIES_WHATSAPP_NUMBER = '919022404260';
export const PROPERTIES_WEBSITE = 'craftsquare.co.in';

export const PROPERTIES_WHATSAPP_URL = `https://wa.me/${PROPERTIES_WHATSAPP_NUMBER}?text=${encodeURIComponent(
  'Hi CraftSquare Properties, I would like help with a property in Mumbai.',
)}`;

export const PROPERTIES_INTENTS = [
  { id: 'buy', label: 'Buy' },
  { id: 'rent', label: 'Rent' },
  { id: 'sell', label: 'Sell' },
  { id: 'rent_out', label: 'Rent out my flat' },
  { id: 'interiors', label: 'Interiors' },
] as const;

export type PropertiesIntentId = (typeof PROPERTIES_INTENTS)[number]['id'];

export function getPropertiesIntentLabel(id: string): string {
  return PROPERTIES_INTENTS.find((intent) => intent.id === id)?.label || '';
}

/**
 * Exact consent wording shown next to the checkbox. Bump the version whenever the
 * text changes so each stored lead records which wording the person agreed to.
 */
export const PROPERTIES_CONSENT_VERSION = 'properties-consent-v1-2026-11-25';
export const PROPERTIES_CONSENT_TEXT =
  'I agree to be contacted by CraftSquare Properties by call, SMS, WhatsApp and RCS messages about properties. I can reply STOP anytime.';

/** Basic abuse limits for the public form. */
export const PROPERTIES_RATE_LIMIT_WINDOW_MINUTES = 10;
export const PROPERTIES_RATE_LIMIT_MAX_PER_IP = 5;
export const PROPERTIES_DUPLICATE_WINDOW_MINUTES = 30;

export const PROPERTIES_SUCCESS_MESSAGE =
  'Thank you. Arun Pandey from CraftSquare Properties will contact you shortly.';
