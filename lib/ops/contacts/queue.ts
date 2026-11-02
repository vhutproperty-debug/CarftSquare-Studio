import { FAR_DATE } from '@/lib/ops/contacts/types';

export function todayUtc(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function addUtcDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/**
 * Daily queue bands:
 * 0 multi-unit owners, 1 agreements expiring within 180 days, 2 never contacted, 3 everyone else.
 */
export function computeQueueBand(input: {
  ownerUnitCount: number;
  nearestAgreementEnd: string;
  lastContactedAt: string;
}, today = todayUtc()): number {
  if (input.ownerUnitCount >= 2) return 0;
  const end = input.nearestAgreementEnd;
  if (end && end !== FAR_DATE && end <= addUtcDays(today, 180)) return 1;
  if (!input.lastContactedAt) return 2;
  return 3;
}
