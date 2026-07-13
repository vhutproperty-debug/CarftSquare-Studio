export const AGREEMENT_STATUSES = [
  'DRAFT',
  'SCHEDULED',
  'SIGNED',
  'REGISTERED',
  'EXPIRING',
  'EXPIRED',
] as const;

export type AgreementStatus = (typeof AGREEMENT_STATUSES)[number];

export const AGREEMENT_TYPES = ['rental', 'sale', 'leave_license'] as const;

export type AgreementType = (typeof AGREEMENT_TYPES)[number];

export const AGREEMENT_STATUS_LABELS: Record<AgreementStatus, string> = {
  DRAFT: 'Draft',
  SCHEDULED: 'Scheduled',
  SIGNED: 'Signed',
  REGISTERED: 'Registered',
  EXPIRING: 'Expiring soon',
  EXPIRED: 'Expired',
};

export const AGREEMENT_TYPE_LABELS: Record<AgreementType, string> = {
  rental: 'Rental agreement',
  sale: 'Sale agreement',
  leave_license: 'Leave & license',
};

export function isAgreementStatus(value: string): value is AgreementStatus {
  return AGREEMENT_STATUSES.includes(value as AgreementStatus);
}

export function agreementStatusTone(status: AgreementStatus): string {
  if (status === 'SIGNED' || status === 'REGISTERED') return 'bg-emerald-100 text-emerald-800';
  if (status === 'EXPIRING') return 'bg-amber-100 text-amber-900';
  if (status === 'EXPIRED') return 'bg-red-100 text-red-800';
  if (status === 'SCHEDULED') return 'bg-blue-100 text-blue-800';
  return 'bg-slate-100 text-slate-700';
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

export function expiryStatus(expiryDate?: string): AgreementStatus | null {
  if (!expiryDate) return null;
  const expiry = new Date(expiryDate).getTime();
  const now = Date.now();
  const thirtyDays = 30 * 24 * 60 * 60 * 1000;
  if (expiry < now) return 'EXPIRED';
  if (expiry - now <= thirtyDays) return 'EXPIRING';
  return null;
}

export { addDays };
