import { AURIS_WHATSAPP_NUMBER, getIntentLabel, getPossessionLabel } from './constants';
import type { AurisIntentId } from './constants';

function buildRentalMessage(possession: string): string {
  return [
    'Hi CraftSquare Studio,',
    '',
    'I own an apartment in Auris Serenity and I\'m looking to rent it out.',
    '',
    `Possession: ${possession}`,
    '',
    'Please share how you can help.',
  ].join('\n');
}

function buildBasicsMessage(possession: string): string {
  return [
    'Hi CraftSquare Studio,',
    '',
    'I own an apartment in Auris Serenity and I\'m looking for AC, kitchen and rental basics.',
    '',
    `Possession: ${possession}`,
    '',
    'Please share the relevant plan and estimate.',
  ].join('\n');
}

function buildFurnishingMessage(possession: string): string {
  return [
    'Hi CraftSquare Studio,',
    '',
    'I own an apartment in Auris Serenity and I\'m planning complete home furnishing.',
    '',
    `Possession: ${possession}`,
    '',
    'Please share the next steps.',
  ].join('\n');
}

export function buildAurisWhatsAppMessage(params: {
  selectedIntent: AurisIntentId | string;
  possessionTimeline: string;
}): string {
  const possession = getPossessionLabel(params.possessionTimeline);

  switch (params.selectedIntent) {
    case 'rental_apartment':
      return buildRentalMessage(possession);
    case 'ac_kitchen_basics':
      return buildBasicsMessage(possession);
    case 'full_home_furnishing':
      return buildFurnishingMessage(possession);
    default:
      return [
        'Hi CraftSquare Studio,',
        '',
        `I own an apartment in Auris Serenity and I'm interested in ${getIntentLabel(params.selectedIntent)}.`,
        '',
        `Possession: ${possession}`,
        '',
        'Please share the next steps.',
      ].join('\n');
  }
}

export function buildAurisWhatsAppUrl(params: {
  selectedIntent: AurisIntentId | string;
  possessionTimeline: string;
}): string {
  const text = buildAurisWhatsAppMessage(params);
  return `https://wa.me/${AURIS_WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
}
