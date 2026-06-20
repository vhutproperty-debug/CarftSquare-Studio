export const INDIAN_MOBILE_ERROR = 'Please enter a valid 10-digit mobile number.';

export function normalizeIndianMobile(value: unknown): string {
  const digits = String(value ?? '').replace(/\D/g, '');
  if (!digits) return '';

  if (digits.length === 12 && digits.startsWith('91')) {
    return digits.slice(2);
  }

  if (digits.length === 11 && digits.startsWith('0')) {
    return digits.slice(1);
  }

  if (digits.length > 10) {
    return digits.slice(-10);
  }

  return digits;
}

export function isValidIndianMobile(value: unknown): boolean {
  const mobile = normalizeIndianMobile(value);
  return /^[6-9]\d{9}$/.test(mobile);
}
