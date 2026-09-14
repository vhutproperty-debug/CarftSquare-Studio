import { registerIntegrationHooks } from '@/lib/estimate/integrations';
import { enqueueFollowUpJob, getFollowUpDatabase } from '@/lib/ops/followups/store';
import { getInteraktTemplateCatalog } from '@/lib/interakt/templates';
import { normalizeIndianMobile, isValidIndianMobile } from '@/lib/phone/indian-mobile';

let registered = false;

/**
 * Wire quotation enquiry → optional delayed WhatsApp welcome/follow-up template job.
 * Never blocks quote creation. Requires INTERAKT_API_KEY + approved template names.
 */
export function registerEstimateWhatsAppHooks(): void {
  if (registered) return;
  registered = true;

  registerIntegrationHooks({
    async onEnquiryCreated(quote) {
      const phone = quote.customer?.phone || quote.customer?.whatsapp;
      const normalized = normalizeIndianMobile(phone);
      if (!isValidIndianMobile(normalized)) return;

      const welcome =
        getInteraktTemplateCatalog().find((t) => t.purpose === 'welcome')
        || getInteraktTemplateCatalog()[0];
      if (!welcome) return;

      const db = await getFollowUpDatabase();
      const scheduledFor = new Date(Date.now() + 5 * 60_000).toISOString();
      await enqueueFollowUpJob(db, {
        targetType: 'ops_lead',
        targetId: quote.id,
        targetSource: 'quotation',
        phone: normalized,
        templateName: welcome.name,
        languageCode: welcome.languageCode,
        bodyValues: [quote.customer?.name || 'there'],
        scheduledFor,
        createdBy: 'system:estimate',
        idempotencyKey: `estimate-welcome:${quote.id}`,
      });
    },
  });
}
