import OpsShell from '@/components/ops/OpsShell';

export default function MetaReviewWhatsAppPage() {
  return (
    <OpsShell title="Review: WhatsApp" subtitle="whatsapp_business_messaging and whatsapp_business_management" workspace>
      <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-700">
        <p>1. Open the WhatsApp inbox. Send the approved lead_welcome template to a test number.</p>
        <pre className="overflow-x-auto rounded-lg bg-slate-950 p-3 text-xs text-slate-100">{`POST /1307101749164145/messages
Body: type=template, template.name=lead_welcome
Permission: whatsapp_business_messaging

GET /4424945177816319/message_templates
Permission: whatsapp_business_management

Webhook: POST https://craftsquare.co.in/api/webhooks/whatsapp`}</pre>
        <p>2. Reply from the phone within 24 hours. The message appears in the inbox. STOP opts the contact out and cancels follow-ups.</p>
        <p>3. /ops/automation shows phone quality, template statuses, and the follow-up queue.</p>
      </div>
    </OpsShell>
  );
}
