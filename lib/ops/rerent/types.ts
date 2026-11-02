export const RERENT_COLLECTION = 'rerent_leases';

export const RERENT_STATUSES = ['not_contacted', 'contacted', 'interested', 'renewed', 'not_renewing', 'do_not_contact'] as const;
export type RerentStatus = (typeof RERENT_STATUSES)[number];

export const RERENT_STATUS_LABELS: Record<RerentStatus, string> = {
  not_contacted: 'Not contacted',
  contacted: 'Contacted',
  interested: 'Interested',
  renewed: 'Renewed',
  not_renewing: 'Not renewing',
  do_not_contact: 'Do not contact',
};

export const EXPIRY_BUCKETS = ['expired', '30', '60', '90', 'later', 'none'] as const;
export type ExpiryBucket = (typeof EXPIRY_BUCKETS)[number];

export const EXPIRY_BUCKET_LABELS: Record<ExpiryBucket, string> = {
  expired: 'Expired',
  '30': 'Next 30 days',
  '60': '31–60 days',
  '90': '61–90 days',
  later: 'After 90 days',
  none: 'No end date',
};

export type RerentHistoryEntry = {
  id: string;
  at: string;
  by: string;
  kind: 'status' | 'note';
  note: string;
};

export type RerentLease = {
  id: string;
  project: string;
  tower: string;
  floor: string;
  flat: string;
  name: string;
  role: 'owner' | 'tenant';
  phone_e164: string;
  email: string;
  lease_end: string;
  status: RerentStatus;
  remarks: string;
  history: RerentHistoryEntry[];
  createdAt: string;
  updatedAt: string;
  lastUpdatedBy: string;
};

export function expiryBucket(leaseEnd: string, today = new Date()): ExpiryBucket {
  if (!leaseEnd.trim()) return 'none';
  const end = new Date(leaseEnd);
  if (Number.isNaN(end.getTime())) return 'none';
  const start = new Date(today);
  start.setHours(0, 0, 0, 0);
  const day = new Date(end);
  day.setHours(0, 0, 0, 0);
  const diff = Math.round((day.getTime() - start.getTime()) / 86400000);
  if (diff < 0) return 'expired';
  if (diff <= 30) return '30';
  if (diff <= 60) return '60';
  if (diff <= 90) return '90';
  return 'later';
}
