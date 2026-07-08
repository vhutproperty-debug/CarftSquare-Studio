import { SATELLITE_WHATSAPP_NUMBER, getIntentLabel, getPossessionLabel } from './constants';
import type { SatelliteIntentId } from './constants';

function buildCompleteInteriorsMessage(possession: string): string {
  return [
    'Hi CraftSquare Studio,',
    '',
    'I am a Satellite Elegance homeowner and would like to plan complete home interiors for my home.',
    '',
    `Possession: ${possession}`,
    '',
    'Please share the next steps for a free design consultation and site visit.',
  ].join('\n');
}

function buildKitchenWardrobesMessage(possession: string): string {
  return [
    'Hi CraftSquare Studio,',
    '',
    'I am a Satellite Elegance homeowner and would like to discuss kitchen, wardrobes and storage for my home.',
    '',
    `Possession: ${possession}`,
    '',
    'Please share how you can help with design, site visit and measurement.',
  ].join('\n');
}

function buildConsultationMessage(possession: string): string {
  return [
    'Hi CraftSquare Studio,',
    '',
    'I am a Satellite Elegance homeowner and would like a free design consultation, site visit and measurement.',
    '',
    `Possession: ${possession}`,
    '',
    'Please let me know the next steps.',
  ].join('\n');
}

export function buildSatelliteWhatsAppMessage(params: {
  selectedIntent: SatelliteIntentId | string;
  possessionTimeline: string;
}): string {
  const possession = getPossessionLabel(params.possessionTimeline);

  switch (params.selectedIntent) {
    case 'complete_home_interiors':
      return buildCompleteInteriorsMessage(possession);
    case 'kitchen_wardrobes_storage':
      return buildKitchenWardrobesMessage(possession);
    case 'free_design_consultation':
      return buildConsultationMessage(possession);
    default:
      return [
        'Hi CraftSquare Studio,',
        '',
        `I am a Satellite Elegance homeowner and I'm interested in ${getIntentLabel(params.selectedIntent)}.`,
        '',
        `Possession: ${possession}`,
        '',
        'Please share the next steps.',
      ].join('\n');
  }
}

export function buildSatelliteWhatsAppUrl(params: {
  selectedIntent: SatelliteIntentId | string;
  possessionTimeline: string;
}): string {
  const text = buildSatelliteWhatsAppMessage(params);
  return `https://wa.me/${SATELLITE_WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
}
