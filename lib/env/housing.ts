/** Server-only Housing.com API credentials. Never expose to the client. */

export const HOUSING_ENV_VARS = {
  baseUrl: 'HOUSING_API_BASE_URL',
  apiKey: 'HOUSING_API_KEY',
  partnerId: 'HOUSING_API_PARTNER_ID',
  /** Optional legacy alias; HMAC uses HOUSING_API_KEY (encryption key from Housing.com). */
  apiSecret: 'HOUSING_API_SECRET',
} as const;

function stripEnvValue(raw: string) {
  return raw.trim().replace(/^["']|["']$/g, '');
}

export function getHousingApiBaseUrl(): string {
  return stripEnvValue(process.env.HOUSING_API_BASE_URL || '');
}

export function getHousingApiKey(): string {
  return stripEnvValue(process.env.HOUSING_API_KEY || '');
}

export function getHousingApiSecret(): string {
  return stripEnvValue(process.env.HOUSING_API_SECRET || '');
}

export function getHousingPartnerId(): string {
  return stripEnvValue(process.env.HOUSING_API_PARTNER_ID || '');
}

/** HMAC signing key — Housing.com provides this as the encryption/API key. */
export function getHousingHmacKey(): string {
  return getHousingApiKey();
}

export function isHousingApiConfigured(): boolean {
  return validateHousingConfig().ok;
}

export type HousingConfigValidation = {
  ok: boolean;
  missing: string[];
  baseUrl: string;
};

export function validateHousingConfig(): HousingConfigValidation {
  const missing: string[] = [];
  if (!getHousingApiBaseUrl()) missing.push(HOUSING_ENV_VARS.baseUrl);
  if (!getHousingApiKey()) missing.push(HOUSING_ENV_VARS.apiKey);
  if (!getHousingPartnerId()) missing.push(HOUSING_ENV_VARS.partnerId);
  return {
    ok: missing.length === 0,
    missing,
    baseUrl: getHousingApiBaseUrl(),
  };
}
