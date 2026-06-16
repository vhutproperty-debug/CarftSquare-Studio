import { BRAND } from '@/lib/brand';

/** Verified Resend sender used when EMAIL_FROM is unset. */
export const DEFAULT_EMAIL_FROM = 'CraftSquare Studio <notifications@craftsquare.co.in>';

/** Canonical names — must match Vercel Environment Variables exactly. */
export const RESEND_ENV_VARS = {
  apiKey: 'RESEND_API_KEY',
  emailFrom: 'EMAIL_FROM',
} as const;

/** Legacy / typo aliases accepted at runtime (logged as warnings). */
const RESEND_API_KEY_ALIASES = ['RESEND_API_KEY', 'RESEND_KEY'] as const;
const EMAIL_FROM_ALIASES = ['EMAIL_FROM', 'RESEND_FROM', 'RESEND_EMAIL'] as const;

function stripEnvValue(raw: string) {
  return raw.trim().replace(/^["']|["']$/g, '');
}

function readFirstEnv(names: readonly string[]) {
  for (const name of names) {
    const raw = process.env[name];
    if (raw?.trim()) {
      return { value: stripEnvValue(raw), source: name };
    }
  }
  return { value: '', source: null as string | null };
}

export function getResendApiKey() {
  return readFirstEnv(RESEND_API_KEY_ALIASES);
}

export function getEmailFromEnv() {
  return readFirstEnv(EMAIL_FROM_ALIASES);
}

export function isResendConfigured() {
  return Boolean(getResendApiKey().value);
}

/** Resolve sender address from env or default. Throws if value is invalid. */
export function resolveEmailFrom(): string {
  const { value } = getEmailFromEnv();
  if (value) {
    return resolveEmailFromValue(value);
  }
  return DEFAULT_EMAIL_FROM;
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
      + `(e.g. ${DEFAULT_EMAIL_FROM}). Received: "${trimmed}"`,
    );
  }

  return `${BRAND.name} <notifications@${domain}>`;
}

export type ResendConfigValidation = {
  ok: boolean;
  missing: string[];
  warnings: string[];
  apiKeySource: string | null;
  emailFromSource: string | null;
  emailFrom: string;
  runtime: string;
};

export function validateResendConfig(): ResendConfigValidation {
  const apiKey = getResendApiKey();
  const emailFromEnv = getEmailFromEnv();
  const missing: string[] = [];
  const warnings: string[] = [];

  if (!apiKey.value) {
    missing.push(RESEND_ENV_VARS.apiKey);
  } else if (apiKey.source !== RESEND_ENV_VARS.apiKey) {
    warnings.push(
      `Found ${apiKey.source} but canonical name is ${RESEND_ENV_VARS.apiKey}. Rename in Vercel for clarity.`,
    );
  }

  let emailFrom = DEFAULT_EMAIL_FROM;
  if (!emailFromEnv.value) {
    warnings.push(
      `${RESEND_ENV_VARS.emailFrom} is not set — using default ${DEFAULT_EMAIL_FROM}. `
      + 'Set EMAIL_FROM explicitly in Vercel Production.',
    );
  } else {
    if (emailFromEnv.source !== RESEND_ENV_VARS.emailFrom) {
      warnings.push(
        `Found ${emailFromEnv.source} but canonical name is ${RESEND_ENV_VARS.emailFrom}. Rename in Vercel for clarity.`,
      );
    }
    try {
      emailFrom = resolveEmailFromValue(emailFromEnv.value);
    } catch (error) {
      missing.push(RESEND_ENV_VARS.emailFrom);
      warnings.push(error instanceof Error ? error.message : String(error));
    }
  }

  const runtime = process.env.VERCEL_ENV
    || (process.env.VERCEL ? 'vercel' : process.env.NODE_ENV || 'unknown');

  return {
    ok: missing.length === 0,
    missing,
    warnings,
    apiKeySource: apiKey.source,
    emailFromSource: emailFromEnv.source || 'default',
    emailFrom,
    runtime,
  };
}

export function formatResendConfigError(validation: ResendConfigValidation): string {
  if (validation.ok) return '';

  const scope = validation.runtime === 'production'
    ? 'Vercel Production'
    : `runtime=${validation.runtime}`;

  const missingList = validation.missing.join(', ');
  return (
    `Missing required environment variable(s): ${missingList}. `
    + `Add them in Vercel → Settings → Environment Variables → enable "Production", then redeploy. `
    + `(${scope})`
  );
}

export function assertResendConfigured(): ResendConfigValidation {
  const validation = validateResendConfig();
  if (!validation.ok) {
    console.error('[resend-env] configuration invalid', {
      missing: validation.missing,
      runtime: validation.runtime,
      apiKeySource: validation.apiKeySource,
      emailFromSource: validation.emailFromSource,
      warnings: validation.warnings,
    });
    throw new Error(formatResendConfigError(validation));
  }

  if (validation.warnings.length) {
    console.warn('[resend-env] configuration warnings', validation.warnings);
  }

  return validation;
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
