import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

/** Resend sandbox only delivers to the Resend account owner email. */
export function loadProjectEnv(rootDir) {
  for (const name of ['.env.local', '.env']) {
    const p = join(rootDir, name);
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, 'utf8').split('\n')) {
      const m = line.match(/^([^#=]+)=(.*)$/);
      if (m && !process.env[m[1].trim()]) {
        process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '');
      }
    }
  }
}

export function isResendSandboxFrom() {
  const from = String(process.env.EMAIL_FROM || '').trim().toLowerCase();
  return from === 'onboarding@resend.dev' || from.includes('onboarding@resend.dev');
}

export function partnerTestEmail(mobile, label = 'otp') {
  if (process.env.PARTNER_OTP_TEST_EMAIL) {
    return process.env.PARTNER_OTP_TEST_EMAIL.trim();
  }
  if (process.env.RESEND_API_KEY && isResendSandboxFrom()) {
    return 'vhutproperty@gmail.com';
  }
  return `${label}.${mobile}@craftsquare.test`;
}
