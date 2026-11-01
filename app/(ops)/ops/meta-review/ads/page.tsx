import Link from 'next/link';
import OpsShell from '@/components/ops/OpsShell';

export default function MetaReviewAdsPage() {
  return (
    <OpsShell title="Review: Paused ads" subtitle="ads_management, ads_read, pages_manage_ads" workspace>
      <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-700">
        <p>Publishing is refused unless META_ADS_ENABLED=true. Every object is created with status PAUSED. ACTIVE requires META_ADS_ALLOW_ACTIVE=true and an admin role.</p>
        <pre className="overflow-x-auto rounded-lg bg-slate-950 p-3 text-xs text-slate-100">{`POST /act_1947289589273795/campaigns
Body: objective=OUTCOME_LEADS, status=PAUSED
Permission: ads_management

GET /act_1947289589273795/insights?level=campaign&date_preset=last_7d
Permission: ads_read

POST /1351127224742253/leadgen_forms
Permission: pages_manage_ads
Privacy URL: https://craftsquare.co.in/privacy-policy`}</pre>
        <p>
          On <Link className="underline" href="/ops/ads#campaigns">/ops/ads</Link>, generate a creative, approve it, create the dry-run campaign, then Publish PAUSED. Use Pause and Resume on the campaigns list. Resume stays blocked until META_ADS_ENABLED and META_ADS_ALLOW_ACTIVE are true. Open <Link className="underline" href="/ops/ads#performance">Performance</Link> for spend, impressions, clicks, leads, and CPL.
        </p>
      </div>
    </OpsShell>
  );
}
