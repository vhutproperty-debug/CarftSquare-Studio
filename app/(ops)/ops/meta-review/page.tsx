import Link from 'next/link';
import OpsShell from '@/components/ops/OpsShell';

const STEPS = [
  {
    href: '/ops/meta-review/leads',
    title: 'Lead Ads',
    permission: 'leads_retrieval',
    detail: 'A test lead appears in the CRM and a WhatsApp welcome is sent.',
  },
  {
    href: '/ops/pages',
    title: 'Pages and lead webhook',
    permission: 'pages_show_list + pages_read_engagement + pages_manage_metadata',
    detail: 'List Pages from /me/accounts, then connect the Page to leadgen.',
  },
  {
    href: '/ops/meta-business',
    title: 'Meta Business',
    permission: 'business_management',
    detail: 'List the business owned ad accounts and Pages.',
  },
  {
    href: '/ops/meta-review/ads',
    title: 'Paused ads',
    permission: 'ads_management + ads_read + pages_manage_ads',
    detail: 'Create a PAUSED lead campaign and read insights.',
  },
  {
    href: '/ops/meta-review/whatsapp',
    title: 'WhatsApp',
    permission: 'whatsapp_business_messaging',
    detail: 'Send an approved template and receive the reply in the inbox.',
  },
];

export default function MetaReviewHome() {
  return (
    <OpsShell
      title="Meta App Review"
      subtitle="Screencast these pages in order. Each step names the Graph call and the permission it uses."
      workspace
    >
      <ol className="space-y-3">
        {STEPS.map((step, index) => (
          <li key={step.href} className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Step {index + 1}</p>
            <h2 className="mt-1 text-lg font-semibold text-slate-900">
              <Link href={step.href} className="underline">{step.title}</Link>
            </h2>
            <p className="mt-1 text-sm text-slate-600">{step.detail}</p>
            <p className="mt-2 text-xs text-slate-500">Permission: {step.permission}</p>
          </li>
        ))}
      </ol>
      <p className="text-sm text-slate-600">
        Reviewer login is documented in docs/meta-app-review.md. Use the ops user supplied with the App Review submission. Do not use a personal Facebook password.
      </p>
    </OpsShell>
  );
}
