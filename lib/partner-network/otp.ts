import crypto from 'node:crypto';

export const OTP_TTL_MS = 5 * 60 * 1000;
export const OTP_MAX_VERIFY_ATTEMPTS = 5;
export const OTP_MAX_SENDS_PER_WINDOW = 3;
export const OTP_SEND_WINDOW_MS = 15 * 60 * 1000;

export function generateOtp() {
  return String(crypto.randomInt(100000, 1000000));
}

export function hashOtp(otp: string, mobile: string) {
  return crypto.createHash('sha256').update(`${mobile}:${otp}`).digest('hex');
}

export function getOtpExpiry() {
  return new Date(Date.now() + OTP_TTL_MS).toISOString();
}

export function isOtpExpired(expiresAt: string | Date) {
  return Date.now() > new Date(expiresAt).getTime();
}

export type PartnerOtpTarget = {
  email: string;
  mobile: string;
  whatsapp?: string;
  fullName: string;
};

export async function dispatchOtpNotification(partner: PartnerOtpTarget, otp: string) {
  const { dispatchPartnerOtp } = await import('@/lib/partner-network/otp-delivery');
  return dispatchPartnerOtp(partner, otp);
}

export { getOtpDeliveryConfig } from '@/lib/partner-network/otp-delivery';
