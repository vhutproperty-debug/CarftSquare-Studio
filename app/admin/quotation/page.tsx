'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import DesignerLeadsPanel from '@/components/admin/quotation/DesignerLeadsPanel';
import QuotationAnalyticsPanel from '@/components/admin/quotation/QuotationAnalyticsPanel';
import QuotationLeadsPanel from '@/components/admin/quotation/QuotationLeadsPanel';
import QuotationPricingPanel from '@/components/admin/quotation/QuotationPricingPanel';

type Tab = 'pricing' | 'leads' | 'designer-leads' | 'analytics';

export default function QuotationAdminPage() {
  const [tab, setTab] = useState<Tab>('pricing');
  const [authed, setAuthed] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    fetch('/api/auth/status', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => {
        setAuthed(Boolean(d.authenticated));
        setChecked(true);
      });
  }, []);

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
            { id: 'analytics' as Tab, label: 'Analytics' },
          ]).map((item) => (
            <Button key={item.id} onClick={() => setTab(item.id)} className={tab === item.id ? 'bg-orange-600 text-white' : 'bg-white/10 text-white'}>
              {item.label}
            </Button>
          ))}
        </div>

        <div className="rounded-3xl border border-white/10 bg-white p-6 text-slate-950">
          {tab === 'pricing' && <QuotationPricingPanel />}
          {tab === 'leads' && <QuotationLeadsPanel />}
          {tab === 'designer-leads' && <DesignerLeadsPanel />}
          {tab === 'analytics' && <QuotationAnalyticsPanel />}
        </div>
      </div>
    </main>
  );
}
