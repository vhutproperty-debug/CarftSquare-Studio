import { AURIS_WHATSAPP_NUMBER, getIntentLabel, getPossessionLabel } from './constants';
import type { AurisIntentId } from './constants';

function buildRentalMessage(name: string, possession: string): string {
  return [
    'Hi CraftSquare Studio,',
    '',
    'I own an apartment in Auris Serenity and I\'m looking to rent it out.',
    '',
    `Possession: ${possession}`,
    `Name: ${name}`,
    '',
    'Please share how you can help.',
  ].join('\n');
}

function buildBasicsMessage(name: string, possession: string): string {
  return [
    'Hi CraftSquare Studio,',
    '',
    'I own an apartment in Auris Serenity and I\'m looking for AC, kitchen and basic work.',
    '',
    `Possession: ${possession}`,
    `Name: ${name}`,
    '',
    'Please share the relevant plan and estimate.',
  ].join('\n');
}

function buildFurnishingMessage(name: string, possession: string): string {
  return [
    'Hi CraftSquare Studio,',
    '',
    'I own an apartment in Auris Serenity and I\'m planning full home furnishing.',
    '',
    `Possession: ${possession}`,
    `Name: ${name}`,
    '',
    'Please share the next steps.',
  ].join('\n');
}

export function buildAurisWhatsAppMessage(params: {
  name: string;
  selectedIntent: AurisIntentId | string;
  possessionTimeline: string;
}): string {
  const possession = getPossessionLabel(params.possessionTimeline);
  const name = params.name.trim();

  switch (params.selectedIntent) {
    case 'rental_apartment':
      return buildRentalMessage(name, possession);
    case 'ac_kitchen_basics':
      return buildBasicsMessage(name, possession);
    case 'full_home_furnishing':
      return buildFurnishingMessage(name, possession);
    default:
      return [
        'Hi CraftSquare Studio,',
        '',
        `I own an apartment in Auris Serenity and I'm interested in ${getIntentLabel(params.selectedIntent)}.`,
        '',
        `Possession: ${possession}`,
        `Name: ${name}`,
        '',
        'Please share the next steps.',
      ].join('\n');
  }
}

export function buildAurisWhatsAppUrl(params: {
  name: string;
  selectedIntent: AurisIntentId | string;
  possessionTimeline: string;
}): string {
  const text = buildAurisWhatsAppMessage(params);
  return `https://wa.me/${AURIS_WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
}
