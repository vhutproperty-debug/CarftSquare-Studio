import { scrubPrivateText } from '@/lib/ops/projects/resale-identity';
import type { PublicResaleUnit, ResaleFollowUp, ResaleUnit } from '@/lib/ops/projects/types';

const PRIVATE_KEYS = ['unitNumber', 'owner', 'floor'] as const;

function secretsOf(unit: ResaleUnit): string[] {
  return [unit.unitNumber, unit.owner?.name, unit.owner?.phone, unit.owner?.whatsapp, unit.owner?.email, unit.floor]
    .filter((value): value is string => Boolean(value));
}

function scrubFollowUp(entry: ResaleFollowUp, secrets: string[]): ResaleFollowUp {
  return { ...entry, note: scrubPrivateText(entry.note, secrets) };
}

export function toPublicResaleUnit(unit: ResaleUnit): PublicResaleUnit {
  const secrets = secretsOf(unit);
  const copy = { ...unit } as ResaleUnit & Partial<Pick<ResaleUnit, 'unitNumber' | 'owner' | 'floor'>>;
  PRIVATE_KEYS.forEach((key) => {
    delete copy[key];
  });
  copy.notes = scrubPrivateText(unit.notes, secrets);
  copy.intent = scrubPrivateText(unit.intent, secrets);
  copy.response = scrubPrivateText(unit.response, secrets);
  copy.nextAction = scrubPrivateText(unit.nextAction, secrets);
  copy.configLabel = scrubPrivateText(unit.configLabel, secrets);
  copy.askingPriceLabel = scrubPrivateText(unit.askingPriceLabel, secrets);
  copy.followUps = (unit.followUps || []).map((entry) => scrubFollowUp(entry, secrets));
  return copy;
}

export function presentResaleUnit(unit: ResaleUnit, canSeeSensitive: boolean): ResaleUnit | PublicResaleUnit {
  return canSeeSensitive ? unit : toPublicResaleUnit(unit);
}

export function unitResponseLeaksPrivate(value: unknown): boolean {
  const json = JSON.stringify(value);
  return /"unitNumber":|"owner":|"whatsapp":|"floor":|flatNumber/i.test(json);
}
