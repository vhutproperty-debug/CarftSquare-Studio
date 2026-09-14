import { getInteraktBusinessWaNumber, INTERAKT_PRODUCTION_WA_NUMBER, LEGACY_MARKETING_WA_NUMBER } from '@/lib/interakt/phone';
import { getInteraktTemplateCatalog } from '@/lib/interakt/templates';

export function getInteraktIntegrationStatus() {
  const businessWa = (() => {
    try {
      return getInteraktBusinessWaNumber();
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'invalid_business_wa',
      };
    }
  })();

  const businessWaNumber = typeof businessWa === 'string' ? businessWa : '';
  const businessWaError = typeof businessWa === 'string' ? null : businessWa.error;

  return {
    provider: 'interakt' as const,
    productionNumberExpected: INTERAKT_PRODUCTION_WA_NUMBER,
    legacyMarketingNumberForbidden: LEGACY_MARKETING_WA_NUMBER,
    businessWaNumber: businessWaNumber || null,
    businessWaConfigured: Boolean(businessWaNumber),
    businessWaMatchesProduction: businessWaNumber === INTERAKT_PRODUCTION_WA_NUMBER,
    businessWaError,
    apiKeyConfigured: Boolean(process.env.INTERAKT_API_KEY?.trim()),
    webhookSecretConfigured: Boolean(process.env.INTERAKT_WEBHOOK_SECRET?.trim()),
    webhookPath: '/api/webhooks/interakt',
    templates: getInteraktTemplateCatalog().map((t) => ({
      name: t.name,
      label: t.label,
      purpose: t.purpose,
      languageCode: t.languageCode,
      bodyVariableCount: t.bodyVariableCount,
    })),
    sessionTextSupported: false,
    notes: [
      'Public Interakt message API supports approved templates only.',
      'Free-form session replies must use Interakt product UI until a documented session API exists.',
    ],
  };
}
