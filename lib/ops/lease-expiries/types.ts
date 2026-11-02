export const LEASE_EXPIRIES_COLLECTION = 'lease_expiries';

export const LEASE_BUCKETS = ['expired', '0_30', '31_60', '61_90', '91_180', 'later'] as const;
export type LeaseBucket = (typeof LEASE_BUCKETS)[number];

export const LEASE_BUCKET_LABELS: Record<LeaseBucket, string> = {
  expired: 'Expired',
  '0_30': '0–30',
  '31_60': '31–60',
  '61_90': '61–90',
  '91_180': '91–180',
  later: 'Later',
};

export const LEASE_CALL_STATUSES = [
  'not_called',
  'called',
  'no_answer',
  'interested',
  'relisted',
  'renewed_by_owner',
  'not_interested',
] as const;
export type LeaseCallStatus = (typeof LEASE_CALL_STATUSES)[number];

export const LEASE_CALL_STATUS_LABELS: Record<LeaseCallStatus, string> = {
  not_called: 'Not called',
  called: 'Called',
  no_answer: 'No answer',
  interested: 'Interested',
  relisted: 'Relisted',
  renewed_by_owner: 'Renewed by owner',
  not_interested: 'Not interested',
};

export type LeaseHistoryEntry = {
  id: string;
  at: string;
  by: string;
  kind: 'status' | 'note';
  note: string;
};

export type LeaseExpiry = {
  id: string;
  project: string;
  tower: string;
  flat: string;
  ownerName: string;
  ownerPhone: string;
  tenantName: string;
  tenantPhone: string;
  leaseStart: string;
  leaseEnd: string;
  priority: string;
  status: LeaseCallStatus;
  notes: string;
  history: LeaseHistoryEntry[];
  createdAt: string;
  updatedAt: string;
  lastUpdatedBy: string;
};

export function normalizeLeaseDate(value: string): string {
  const trimmed = value.trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(trimmed);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const dmy = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/.exec(trimmed);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  return '';
}

export function daysToExpiry(leaseEnd: string, today = new Date()): number | null {
  const iso = normalizeLeaseDate(leaseEnd);
  if (!iso) return null;
  const end = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(end.getTime())) return null;
  const start = new Date(today);
  start.setHours(0, 0, 0, 0);
  return Math.round((end.getTime() - start.getTime()) / 86400000);
}

export function leaseBucket(leaseEnd: string, today = new Date()): LeaseBucket | '' {
  const days = daysToExpiry(leaseEnd, today);
  if (days == null) return '';
  if (days < 0) return 'expired';
  if (days <= 30) return '0_30';
  if (days <= 60) return '31_60';
  if (days <= 90) return '61_90';
  if (days <= 180) return '91_180';
  return 'later';
}
