import OpsShell from '@/components/ops/OpsShell';

export default function MetaReviewPageConnect() {
  return (
    <OpsShell title="Review: Page connect" subtitle="pages_show_list and pages_manage_metadata" workspace>
      <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-700">
        <p>1. Open Meta Ads in ops. The readiness card lists Pages the token can see.</p>
        <pre className="overflow-x-auto rounded-lg bg-slate-950 p-3 text-xs text-slate-100">{`GET /me/accounts
Permission: pages_show_list

POST /1351127224742253/subscribed_apps
Body: subscribed_fields=leadgen
Permission: pages_manage_metadata`}</pre>
        <p>2. Use “Subscribe Page to leadgen” on /ops/ads. The button calls POST /api/ops/ads/page-subscription.</p>
        <p>3. Confirm the subscription with GET /api/ops/ads/page-subscription. Lead ads then arrive in real time.</p>
      </div>
    </OpsShell>
  );
}
