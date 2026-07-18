'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import DesignerLeadsPanel from '@/components/admin/quotation/DesignerLeadsPanel';
import ReviewsPanel from '@/components/admin/quotation/ReviewsPanel';
import QuotationAnalyticsPanel from '@/components/admin/quotation/QuotationAnalyticsPanel';
import QuotationLeadsPanel from '@/components/admin/quotation/QuotationLeadsPanel';
import QuotationPricingPanel from '@/components/admin/quotation/QuotationPricingPanel';
import { canAccess } from '@/lib/auth/rbac/client';

type Tab = 'pricing' | 'leads' | 'designer-leads' | 'reviews' | 'analytics';

const TAB_PERMISSIONS: Record<Tab, { module: string; action?: string }> = {
  pricing: { module: 'ai_quotes', action: 'view' },
  leads: { module: 'ai_quotes', action: 'view' },
  'designer-leads': { module: 'customers', action: 'view' },
  reviews: { module: 'reviews', action: 'view' },
  analytics: { module: 'analytics', action: 'view' },
};

export default function QuotationAdminPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('pricing');
  const [authed, setAuthed] = useState(false);
  const [checked, setChecked] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [accessDenied, setAccessDenied] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);

    fetch('/api/auth/status', { credentials: 'include', signal: controller.signal })
      .then((r) => r.json())
      .then((d) => {
        setAuthed(Boolean(d.authenticated));
        setUser(d.user || null);
        setChecked(true);

        const allowedTabs = (Object.keys(TAB_PERMISSIONS) as Tab[]).filter((id) =>
          canAccess(d.user, TAB_PERMISSIONS[id].module, TAB_PERMISSIONS[id].action || 'view'),
        );

        if (d.authenticated && !allowedTabs.length) {
          router.replace('/admin?denied=ai_quotes');
          return;
        }

        if (allowedTabs.length && !allowedTabs.includes(tab)) {
          setTab(allowedTabs[0]);
        }
      })
      .catch(() => {
        setChecked(true);
        setAuthed(false);
      })
      .finally(() => {
        clearTimeout(timer);
        setChecked(true);
      });
    // Intentionally omit `tab` — only redirect when auth loads, not on every tab click.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  const visibleTabs = (Object.keys(TAB_PERMISSIONS) as Tab[]).filter((id) =>
    canAccess(user, TAB_PERMISSIONS[id].module, TAB_PERMISSIONS[id].action || 'view'),
  );

  function selectTab(nextTab: Tab) {
    if (!canAccess(user, TAB_PERMISSIONS[nextTab].module, TAB_PERMISSIONS[nextTab].action || 'view')) {
      setAccessDenied('Access denied. You do not have permission to view that section.');
      return;
    }
    setAccessDenied('');
    setTab(nextTab);
  }

  if (!checked) {
    return <div className="min-h-screen grid place-items-center bg-slate-950 text-white">Checking admin session...</div>;
  }

  if (!authed) {
    return (
      <div className="min-h-screen grid place-items-center bg-slate-950 text-white">
        <Card className="max-w-md">
          <CardContent className="space-y-4 p-8 text-center text-slate-950">
            <p className="font-bold">Admin login required.</p>
            <Link href="/admin"><Button className="bg-orange-600 text-white">Go to Admin Login</Button></Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 py-10 text-white" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <div className="container space-y-8">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <Badge className="mb-3 bg-orange-500 text-white hover:bg-orange-500">AI Quotation Platform</Badge>
            <h1 className="text-3xl font-black md:text-5xl" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
              Quotation Management
            </h1>
            <p className="mt-2 text-slate-300">Pricing, leads and analytics for the AI estimate platform.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/admin"><Button variant="outline" className="border-white/20 bg-white/10 text-white">Main Admin</Button></Link>
            <Link href="/estimate"><Button className="bg-orange-600 font-black text-white hover:bg-orange-700">View Estimate</Button></Link>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {([
            { id: 'pricing' as Tab, label: 'Pricing' },
            { id: 'leads' as Tab, label: 'AI Leads' },
            { id: 'designer-leads' as Tab, label: 'Human Designer Leads' },
            { id: 'reviews' as Tab, label: 'Customer Reviews' },
            { id: 'analytics' as Tab, label: 'Analytics' },
          ]).filter((item) => visibleTabs.includes(item.id)).map((item) => (
            <Button key={item.id} onClick={() => selectTab(item.id)} className={tab === item.id ? 'bg-orange-600 text-white' : 'bg-white/10 text-white'}>
              {item.label}
            </Button>
          ))}
        </div>

        {accessDenied && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{accessDenied}</div>
        )}

        <div className="rounded-3xl border border-white/10 bg-white p-6 text-slate-950">
          {tab === 'pricing' && visibleTabs.includes('pricing') && <QuotationPricingPanel />}
          {tab === 'leads' && visibleTabs.includes('leads') && <QuotationLeadsPanel />}
          {tab === 'designer-leads' && visibleTabs.includes('designer-leads') && <DesignerLeadsPanel />}
          {tab === 'reviews' && visibleTabs.includes('reviews') && <ReviewsPanel />}
          {tab === 'analytics' && visibleTabs.includes('analytics') && <QuotationAnalyticsPanel />}
        </div>
      </div>
    </main>
  );
}
