export const REVENUE_STATUSES = [
  'EXPECTED',
  'INVOICED',
  'PARTIAL',
  'COLLECTED',
  'OVERDUE',
  'WRITTEN_OFF',
] as const;

export type RevenueStatus = (typeof REVENUE_STATUSES)[number];

export const REVENUE_STREAM_TYPES = [
  'rental_brokerage',
  'sale_brokerage',
  'interior_referral',
  'service_referral',
] as const;

export type RevenueStreamType = (typeof REVENUE_STREAM_TYPES)[number];

export const REVENUE_STATUS_LABELS: Record<RevenueStatus, string> = {
  EXPECTED: 'Expected',
  INVOICED: 'Invoiced',
  PARTIAL: 'Partially collected',
  COLLECTED: 'Collected',
  OVERDUE: 'Overdue',
  WRITTEN_OFF: 'Written off',
};

export const REVENUE_STREAM_LABELS: Record<RevenueStreamType, string> = {
  rental_brokerage: 'Rental brokerage',
  sale_brokerage: 'Sale brokerage',
  interior_referral: 'Interior referral',
  service_referral: 'Service referral',
};

export function isRevenueStatus(value: string): value is RevenueStatus {
  return REVENUE_STATUSES.includes(value as RevenueStatus);
}

export function revenueStatusTone(status: RevenueStatus): string {
  if (status === 'COLLECTED') return 'bg-emerald-100 text-emerald-800';
  if (status === 'OVERDUE') return 'bg-red-100 text-red-800';
  if (status === 'PARTIAL') return 'bg-amber-100 text-amber-900';
  if (status === 'INVOICED') return 'bg-blue-100 text-blue-800';
  return 'bg-slate-100 text-slate-700';
}
