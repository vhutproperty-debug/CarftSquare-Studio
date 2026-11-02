import type { PublicResaleUnit, ResaleUnit } from '@/lib/ops/projects/types';

const PRIVATE_KEYS = ['unitNumber', 'owner'] as const;

export function toPublicResaleUnit(unit: ResaleUnit): PublicResaleUnit {
  const copy = { ...unit } as ResaleUnit & Partial<Pick<ResaleUnit, 'unitNumber' | 'owner'>>;
  PRIVATE_KEYS.forEach((key) => {
    delete copy[key];
  });
  return copy;
}

export function presentResaleUnit(unit: ResaleUnit, canSeeSensitive: boolean): ResaleUnit | PublicResaleUnit {
  return canSeeSensitive ? unit : toPublicResaleUnit(unit);
}

export function unitResponseLeaksPrivate(value: unknown): boolean {
  const json = JSON.stringify(value);
  return /"unitNumber"|"owner"|flatNumber/i.test(json);
}
