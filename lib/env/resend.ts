import { BRAND } from '@/lib/brand';

/** Canonical Vercel / server env names — do not use aliases in production. */
export const RESEND_ENV_VARS = {
  apiKey: 'RESEND_API_KEY',
  emailFrom: 'EMAIL_FROM',
} as const;

export const REQUIRED_EMAIL_FROM_EXAMPLE = 'CraftSquare Studio <notifications@craftsquare.co.in>';

function stripEnvValue(raw: string) {
  return raw.trim().replace(/^["']|["']$/g, '');
}

export function getResendApiKey(): string {
  return stripEnvValue(process.env.RESEND_API_KEY || '');
}

export function getEmailFromRaw(): string {
  return stripEnvValue(process.env.EMAIL_FROM || '');
}

export function isResendConfigured(): boolean {
  return Boolean(getResendApiKey() && getEmailFromRaw());
}

export function resolveEmailFromValue(raw: string): string {
  const trimmed = stripEnvValue(raw);

  if (trimmed.includes('@')) {
    return trimmed;
  }

  const domain = trimmed.replace(/^https?:\/\//, '').replace(/\/$/, '');
  if (!domain.includes('.')) {
    throw new Error(
      `${RESEND_ENV_VARS.emailFrom} must be a verified sender address `
      + `(e.g. ${REQUIRED_EMAIL_FROM_EXAMPLE}). Received: "${trimmed}"`,
    );
  }

  return `${BRAND.name} <notifications@${domain}>`;
}

export function resolveEmailFrom(): string {
  const raw = getEmailFromRaw();
  if (!raw) {
    throw new Error(`Missing required environment variable: ${RESEND_ENV_VARS.emailFrom}`);
  }
  return resolveEmailFromValue(raw);
}

export type ResendConfigValidation = {
  ok: boolean;
  missing: string[];
  emailFrom: string;
  runtime: string;
};

export function validateResendConfig(): ResendConfigValidation {
  const missing: string[] = [];

  if (!getResendApiKey()) {
    missing.push(RESEND_ENV_VARS.apiKey);
  }
  if (!getEmailFromRaw()) {
    missing.push(RESEND_ENV_VARS.emailFrom);
  }

  let emailFrom = '';
  if (!missing.includes(RESEND_ENV_VARS.emailFrom)) {
    try {
      emailFrom = resolveEmailFrom();
    } catch {
      missing.push(RESEND_ENV_VARS.emailFrom);
    }
  }

  const runtime = process.env.VERCEL_ENV
    || (process.env.VERCEL ? 'vercel' : process.env.NODE_ENV || 'unknown');

  return {
    ok: missing.length === 0,
    missing,
    emailFrom,
    runtime,
  };
}

export function formatResendConfigError(validation: ResendConfigValidation): string {
  if (validation.ok) return '';

  const scope = validation.runtime === 'production'
    ? 'Vercel Production'
    : `runtime=${validation.runtime}`;

  return (
    `Missing required environment variable(s): ${validation.missing.join(', ')}. `
    + `Set ${RESEND_ENV_VARS.apiKey} and ${RESEND_ENV_VARS.emailFrom} in Vercel → Settings → Environment Variables `
    + `→ enable "Production", then redeploy. (${scope})`
  );
}

/** Startup + OTP validation — throws with exact missing variable names. */
export function assertResendConfigured(): ResendConfigValidation {
  const validation = validateResendConfig();

  if (!validation.ok) {
    for (const name of validation.missing) {
      console.error(`[resend-env] missing ${name}`, { runtime: validation.runtime });
    }
    throw new Error(formatResendConfigError(validation));
  }

  return validation;
}

/** Called from instrumentation on production server cold start. */
export function validateResendConfigAtStartup(): void {
  if (process.env.NEXT_PHASE === 'phase-production-build') return;
  if (process.env.VERCEL_ENV !== 'production' && process.env.NODE_ENV !== 'production') return;

  try {
    assertResendConfigured();
    console.info('[resend-env] production email configuration OK', {
      emailFrom: resolveEmailFrom().replace(/<[^>]+>/, '<***>'),
      runtime: process.env.VERCEL_ENV || process.env.NODE_ENV,
    });
  } catch (error) {
    console.error('[resend-env] startup validation failed', {
      error: error instanceof Error ? error.message : error,
    });
    throw error;
  }
}

export function getOtpDeliveryConfig() {
  const validation = validateResendConfig();
  const whatsapp = Boolean(process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.WHATSAPP_ACCESS_TOKEN);
  return {
    emailProvider: validation.ok ? 'resend' : 'none',
    whatsappProvider: whatsapp ? 'meta_whatsapp' : 'none',
    emailConfigured: validation.ok,
    whatsappConfigured: whatsapp,
    validation,
  };
}
