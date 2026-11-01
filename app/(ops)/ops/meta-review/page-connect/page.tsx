import Link from 'next/link';
import OpsShell from '@/components/ops/OpsShell';

export default function MetaReviewPageConnect() {
  return (
    <OpsShell title="Review: Page connect" subtitle="pages_show_list and pages_manage_metadata" workspace>
      <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-700">
        <p>1. Open <Link className="underline" href="/ops/pages">Pages</Link>. The list comes from /me/accounts and shows the Page name, fan count, and lead forms.</p>
        <pre className="overflow-x-auto rounded-lg bg-slate-950 p-3 text-xs text-slate-100">{`GET /me/accounts
Permission: pages_show_list

POST /1351127224742253/subscribed_apps
Body: subscribed_fields=leadgen
Permission: pages_manage_metadata`}</pre>
        <p>2. Use <Link className="underline" href="/ops/pages#page-connect">Connect Page for leads</Link>. The button calls POST /api/ops/ads/page-subscription with the Page token. Unsubscribe is on the same card.</p>
        <p>3. Confirm the subscription with GET /api/ops/ads/page-subscription. Lead ads then arrive in real time.</p>
      </div>
    </OpsShell>
  );
}
