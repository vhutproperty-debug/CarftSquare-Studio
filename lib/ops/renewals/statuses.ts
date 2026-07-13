export const RENEWAL_STATUSES = ['UPCOMING', 'DUE', 'RENEWED', 'LAPSED'] as const;

export type RenewalStatus = (typeof RENEWAL_STATUSES)[number];

export const RENEWAL_STATUS_LABELS: Record<RenewalStatus, string> = {
  UPCOMING: 'Upcoming',
  DUE: 'Due now',
  RENEWED: 'Renewed',
  LAPSED: 'Lapsed',
};

export function isRenewalStatus(value: string): value is RenewalStatus {
  return RENEWAL_STATUSES.includes(value as RenewalStatus);
}

export function renewalStatusTone(status: RenewalStatus): string {
  if (status === 'RENEWED') return 'bg-emerald-100 text-emerald-800';
  if (status === 'DUE') return 'bg-red-100 text-red-800';
  if (status === 'LAPSED') return 'bg-slate-200 text-slate-700';
  return 'bg-amber-100 text-amber-900';
}
