import type { DemandQualification } from '@/lib/ops/demand/types';

const QUALIFICATION_FIELDS: Array<keyof DemandQualification> = [
  'rentBuy',
  'budget',
  'bhk',
  'furnishing',
  'preferredBuildings',
  'possessionTimeline',
  'familyOrBachelor',
  'company',
  'parkingRequirement',
  'pets',
  'notes',
];

export function computeQualificationPercent(qualification: DemandQualification): number {
  if (!qualification || typeof qualification !== 'object') return 0;
  const filled = QUALIFICATION_FIELDS.filter((field) => {
    const value = qualification[field];
    if (value == null) return false;
    if (typeof value === 'string') return value.trim().length > 0;
    return true;
  }).length;
  return Math.round((filled / QUALIFICATION_FIELDS.length) * 100);
}

export function mergeQualification(
  existing: DemandQualification,
  patch: Partial<DemandQualification>,
): DemandQualification {
  return { ...existing, ...patch };
}
