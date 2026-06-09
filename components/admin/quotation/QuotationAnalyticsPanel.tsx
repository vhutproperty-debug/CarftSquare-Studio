'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type Analytics = {
  totalQuotations: number;
  conversionRate: number;
  averageBudget: number;
  interiorLeads: number;
  rentalLeads: number;
  kitchenLeads: number;
  wardrobeLeads: number;
  byCity: Record<string, number>;
  byLanding: Record<string, number>;
  monthly: Record<string, number>;
  byPropertyPurpose: Record<string, number>;
  ownResidenceLeads: number;
  rentalFurnishingLeads: number;
};

export default function QuotationAnalyticsPanel() {
  const [data, setData] = useState<Analytics | null>(null);

  useEffect(() => {
    fetch('/api/admin/quotation/analytics', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => setData(d));
  }, []);

  if (!data) return <p className="text-slate-500">Loading analytics...</p>;

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card><CardHeader><CardTitle>Total Quotations</CardTitle></CardHeader><CardContent className="text-3xl font-black">{data.totalQuotations}</CardContent></Card>
      <Card><CardHeader><CardTitle>Conversion Rate</CardTitle></CardHeader><CardContent className="text-3xl font-black">{data.conversionRate}%</CardContent></Card>
      <Card><CardHeader><CardTitle>Average Budget</CardTitle></CardHeader><CardContent className="text-3xl font-black">₹{data.averageBudget.toLocaleString('en-IN')}</CardContent></Card>
      <Card><CardHeader><CardTitle>Interior Leads</CardTitle></CardHeader><CardContent className="text-3xl font-black">{data.interiorLeads}</CardContent></Card>
      <Card><CardHeader><CardTitle>Rental Leads</CardTitle></CardHeader><CardContent className="text-3xl font-black">{data.rentalLeads}</CardContent></Card>
      <Card><CardHeader><CardTitle>Own Residence</CardTitle></CardHeader><CardContent className="text-3xl font-black">{data.ownResidenceLeads}</CardContent></Card>
      <Card><CardHeader><CardTitle>Rental Furnishing</CardTitle></CardHeader><CardContent className="text-3xl font-black">{data.rentalFurnishingLeads}</CardContent></Card>
      <Card><CardHeader><CardTitle>Kitchen Leads</CardTitle></CardHeader><CardContent className="text-3xl font-black">{data.kitchenLeads}</CardContent></Card>
      <Card><CardHeader><CardTitle>Wardrobe Leads</CardTitle></CardHeader><CardContent className="text-3xl font-black">{data.wardrobeLeads}</CardContent></Card>
      <Card>
        <CardHeader><CardTitle>Top Cities</CardTitle></CardHeader>
        <CardContent className="space-y-1 text-sm text-slate-600">
          {Object.entries(data.byCity).map(([city, count]) => <p key={city}>{city}: {count}</p>)}
        </CardContent>
      </Card>
      <Card className="md:col-span-2">
        <CardHeader><CardTitle>Landing Page Performance</CardTitle></CardHeader>
        <CardContent className="space-y-1 text-sm text-slate-600">
          {Object.entries(data.byLanding).map(([page, count]) => <p key={page}>{page}: {count}</p>)}
        </CardContent>
      </Card>
      <Card className="md:col-span-2">
        <CardHeader><CardTitle>Monthly Trends</CardTitle></CardHeader>
        <CardContent className="space-y-1 text-sm text-slate-600">
          {Object.entries(data.monthly).map(([month, count]) => <p key={month}>{month}: {count}</p>)}
        </CardContent>
      </Card>
    </div>
  );
}
