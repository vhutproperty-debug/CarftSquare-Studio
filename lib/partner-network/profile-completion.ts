import type { PartnerRecord } from '@/lib/partner-network/types';

const STEP2_KEYS: (keyof PartnerRecord)[] = [
  'operatingAreas',
  'dealType',
  'projectsCovered',
  'dealsPerMonth',
  'city',
  'state',
  'whatsapp',
];

function filled(value: unknown) {
  return String(value ?? '').trim().length > 0;
}

/** Snap to 25 / 50 / 75 / 100 for CRM display */
export function calculateProfileCompletion(partner: Partial<PartnerRecord>): number {
  if (!filled(partner.fullName) || !filled(partner.mobile)) return 0;

  const step2Filled = STEP2_KEYS.filter((key) => filled(partner[key])).length;
  if (step2Filled === 0) return 25;

  const raw = 25 + Math.round((step2Filled / STEP2_KEYS.length) * 75);
  if (raw <= 37) return 50;
  if (raw <= 62) return 75;
  return 100;
}

export function deriveRegistrationStatus(
  partner: Partial<PartnerRecord>,
): 'incomplete' | 'complete' {
  return calculateProfileCompletion(partner) >= 100 ? 'complete' : 'incomplete';
}

export function formatPartnerDisplayStatus(partner: PartnerRecord): string {
  if (partner.status === 'rejected') return 'Rejected';
  if (partner.status === 'approved') return 'Approved';
  if (partner.registrationStatus === 'incomplete') return 'Incomplete';
  if (partner.registrationStatus === 'complete' && partner.status === 'pending') return 'Complete';
  return partner.status;
}
