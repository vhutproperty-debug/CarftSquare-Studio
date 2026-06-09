'use client';

import { useEffect, useState } from 'react';
import EstimateLayout from '@/components/estimate/EstimateLayout';
import EstimateResultView from '@/components/estimate/EstimateResultView';
import EstimateSkeleton from '@/components/estimate/EstimateSkeleton';
import type { QuotationQuote, QuickAdjustmentAction } from '@/lib/estimate/types';

export default function EstimateResultPage({ params }: { params: { quoteId: string } }) {
  const [quote, setQuote] = useState<QuotationQuote | null>(null);
  const [explanation, setExplanation] = useState('');
  const [loading, setLoading] = useState(true);
  const [adjusting, setAdjusting] = useState(false);
  const [error, setError] = useState('');

  async function loadQuote() {
    setLoading(true);
    try {
      const res = await fetch(`/api/estimate/quote/${params.quoteId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Quote not found');
      setQuote(data.quote);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load quote');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadQuote();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.quoteId]);

  async function handleAdjust(action: QuickAdjustmentAction) {
    setAdjusting(true);
    try {
      const res = await fetch(`/api/estimate/quote/${params.quoteId}/adjust`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Adjustment failed');
      setQuote(data.quote);
      setExplanation(data.explanation || '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Adjustment failed');
    } finally {
      setAdjusting(false);
    }
  }

  return (
    <EstimateLayout premium title="Your AI Interior Report" subtitle="Personalised estimate, design direction and furnishing recommendations by CraftSquare Studio">
      {loading && <EstimateSkeleton />}
      {error && <p className="text-center text-sm font-semibold text-red-600">{error}</p>}
      {quote && <EstimateResultView quote={quote} explanation={explanation} onAdjust={handleAdjust} adjusting={adjusting} />}
    </EstimateLayout>
  );
}
