'use client';

import Link from 'next/link';
import { Download, MessageCircle, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { DISCLAIMER } from '@/lib/estimate/defaults';
import { whatsappUrl } from '@/lib/brand';
import type { QuotationQuote } from '@/lib/estimate/types';
import EstimateQuickActions from './EstimateQuickActions';
import type { QuickAdjustmentAction } from '@/lib/estimate/types';
import './estimate-animations.css';

function storageScore(priority: string) {
  if (/essential/i.test(priority)) return 95;
  if (/important/i.test(priority)) return 80;
  if (/moderate/i.test(priority)) return 65;
  return 40;
}

const designerWhatsapp = `${whatsappUrl.split('?')[0]}?text=${encodeURIComponent('Hi CraftSquare Studio, I have completed my AI interior estimate and would like to speak with a senior designer.')}`;

export default function EstimateResultView({
  quote,
  explanation,
  onAdjust,
  adjusting,
}: {
  quote: QuotationQuote;
  explanation?: string;
  onAdjust: (action: QuickAdjustmentAction) => void;
  adjusting?: boolean;
}) {
  const { pricing, aiSummary } = quote;
  const score = storageScore(aiSummary.priority);
  const premiumSuggestions = pricing.recommendedAddons.length
    ? pricing.recommendedAddons
    : ['Designer lighting', 'Premium hardware upgrade', 'Custom storage solutions'];

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div className="estimate-fade-in text-center">
        <Badge className="mb-5 bg-orange-500 text-white hover:bg-orange-500">Report Complete</Badge>
        <h2
          className="text-3xl font-black text-slate-950 md:text-5xl"
          style={{ fontFamily: "'Cormorant Garamond', serif" }}
        >
          Your AI Interior Report is Ready
        </h2>
      </div>

      <Card className="estimate-scale-in overflow-hidden border-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white shadow-2xl">
        <CardContent className="p-10 text-center md:p-14">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-orange-300">Estimated Budget</p>
          <p
            className="mt-4 text-4xl font-black md:text-6xl"
            style={{ fontFamily: "'Cormorant Garamond', serif" }}
          >
            {pricing.formattedRange}
          </p>
          <p className="mt-5 text-slate-300">Timeline: {pricing.timelineWeeks}</p>
          <p className="mt-2 text-xs text-slate-500">Quote ID: {quote.quoteNumber}</p>
        </CardContent>
      </Card>

      <div className="grid gap-5 sm:grid-cols-2">
        {[
          ['Recommended Package', pricing.packageName],
          ['Timeline', pricing.timelineWeeks],
          ['Design Style', pricing.styleRecommendation],
          ['Material Recommendation', pricing.materialRecommendation],
        ].map(([title, value]) => (
          <Card key={title} className="estimate-glass-card estimate-fade-in-up border-0 shadow-none">
            <CardContent className="p-6">
              <p className="text-xs font-bold uppercase tracking-wider text-orange-600">{title}</p>
              <p className="mt-2 text-lg font-black text-slate-950">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="estimate-glass-card border-0 shadow-none">
        <CardContent className="p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-orange-600">Storage Score</p>
              <p className="mt-1 text-sm text-slate-600">Optimisation potential for your space</p>
            </div>
            <p className="text-4xl font-black text-orange-600">{score}%</p>
          </div>
          <div className="mt-5 h-2.5 overflow-hidden rounded-full bg-slate-100">
            <div className="estimate-progress-fill h-full rounded-full" style={{ width: `${score}%` }} />
          </div>
        </CardContent>
      </Card>

      <Card className="estimate-glass-card border-0 shadow-none">
        <CardContent className="space-y-3 p-6">
          <p className="flex items-center gap-2 font-black text-slate-950">
            <Sparkles className="h-4 w-4 text-orange-500" /> AI Insights
          </p>
          <p className="text-sm leading-7 text-slate-600">
            {quote.propertyPurpose
              ? `Your ${quote.propertyPurpose.toLowerCase()} project aligns with a ${aiSummary.styleRecommendation} direction. `
              : ''}
            Designed for {aiSummary.lifestyle} living with {aiSummary.priority} as your core priority.
            Budget range {aiSummary.budget} suits the {pricing.packageName} package.
          </p>
        </CardContent>
      </Card>

      <Card className="estimate-glass-card border-0 shadow-none">
        <CardContent className="space-y-4 p-6">
          <p className="font-black text-slate-950">Premium Suggestions</p>
          <div className="flex flex-wrap gap-2">
            {premiumSuggestions.map((item) => (
              <span
                key={item}
                className="rounded-full border border-orange-100 bg-orange-50 px-4 py-2 text-sm font-semibold text-orange-800"
              >
                {item}
              </span>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="estimate-glass-card border-0 shadow-none">
        <CardContent className="grid gap-2 p-6 text-sm text-slate-600">
          <p className="font-black text-slate-950">Project Summary</p>
          <p><strong>Project:</strong> {aiSummary.projectType}</p>
          <p><strong>Area:</strong> {aiSummary.area}</p>
          <p><strong>Lifestyle:</strong> {aiSummary.lifestyle}</p>
          <p><strong>Budget:</strong> {aiSummary.budget}</p>
          {quote.propertyPurpose && <p><strong>Property Purpose:</strong> {quote.propertyPurpose}</p>}
        </CardContent>
      </Card>

      {explanation && (
        <Card className="border-orange-100 bg-orange-50/50">
          <CardContent className="p-6 text-sm leading-7 text-slate-700">{explanation}</CardContent>
        </Card>
      )}

      <div>
        <p className="mb-4 text-sm font-bold text-slate-700">Refine your estimate instantly</p>
        <EstimateQuickActions onAdjust={onAdjust} loading={adjusting} />
      </div>

      <div className="estimate-fade-in-up flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:justify-center">
        <Link href="/#quote">
          <Button className="h-14 w-full rounded-2xl bg-gradient-to-r from-orange-600 to-orange-500 px-8 font-black text-white shadow-lg shadow-orange-600/25 hover:from-orange-700 hover:to-orange-600 sm:w-auto">
            Book Free Consultation
          </Button>
        </Link>
        <a href={`/api/estimate/quote/${quote.id}/pdf`} target="_blank" rel="noreferrer">
          <Button
            variant="outline"
            className="h-14 w-full rounded-2xl border-slate-200 px-8 font-black sm:w-auto"
          >
            <Download className="mr-2 h-4 w-4" /> Download AI Estimate
          </Button>
        </a>
        <a href={designerWhatsapp} target="_blank" rel="noreferrer">
          <Button
            variant="outline"
            className="h-14 w-full rounded-2xl border-emerald-200 bg-emerald-50 px-8 font-black text-emerald-800 hover:bg-emerald-100 sm:w-auto"
          >
            <MessageCircle className="mr-2 h-4 w-4" /> Talk to Senior Designer
          </Button>
        </a>
      </div>

      <Card className="border-slate-200 bg-slate-50/80">
        <CardContent className="p-5 text-sm leading-7 text-slate-600">{DISCLAIMER}</CardContent>
      </Card>

      <div className="text-center">
        <Link href="/" className="text-sm font-semibold text-slate-500 hover:text-orange-600">
          Return to website
        </Link>
      </div>
    </div>
  );
}
