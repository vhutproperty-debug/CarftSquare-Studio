import OpsShell from '@/components/ops/OpsShell';

export default function MetaReviewLeadsPage() {
  return (
    <OpsShell title="Review: Lead Ads" subtitle="Permission leads_retrieval" workspace>
      <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-700">
        <p>1. Sign in to ops. Open this page, then open Leads.</p>
        <p>2. In Meta Lead Ads Testing, submit a test lead for Page 1351127224742253.</p>
        <p>3. CraftSquare receives the webhook and reads the form answers.</p>
        <pre className="overflow-x-auto rounded-lg bg-slate-950 p-3 text-xs text-slate-100">{`GET /{leadgen-id}?fields=field_data,created_time,ad_id,ad_name,adset_id,adset_name,campaign_id,campaign_name,form_id,platform,is_organic
Permission: leads_retrieval
Webhook: POST https://craftsquare.co.in/api/webhooks/meta-leads`}</pre>
        <p>4. The lead shows under Demand. The person receives the approved lead_welcome WhatsApp template. The owner receives an alert.</p>
        <p>Only this business Page is read. The phone number is used to contact the person who asked for a callback.</p>
      </div>
    </OpsShell>
  );
}
