import { createNotification } from '@/lib/research/monitoring/notification-store';
import type { TrendSnapshot } from '@/lib/research/monitoring/types';

/**
 * Proactive, evidence-based insights for the ExecutiveResearchAgent / notification feed.
 * Never invents numbers — only restates computed trend evidence.
 */
export function buildProactiveInsights(trends: TrendSnapshot[]): string[] {
  const insights: string[] = [];
  for (const t of trends.slice(0, 12)) {
    if (t.inventoryDeltaPct != null && Math.abs(t.inventoryDeltaPct) >= 10) {
      insights.push(
        `${t.entityLabel} inventory ${t.inventoryDeltaPct > 0 ? 'gained' : 'lost'} ${Math.abs(t.inventoryDeltaPct)}% in the recent trend window (n=${t.sampleSize} observations).`,
      );
    }
    if (t.averageRentDelta != null && Math.abs(t.averageRentDelta) >= 2000) {
      insights.push(
        `Average asking rent for ${t.entityLabel} moved by ₹${t.averageRentDelta.toLocaleString('en-IN')} based on ${t.sampleSize} priced observation(s).`,
      );
    }
    if (t.averageSaleDelta != null && Math.abs(t.averageSaleDelta) >= 100000) {
      insights.push(
        `Average asking sale price for ${t.entityLabel} moved by ₹${t.averageSaleDelta.toLocaleString('en-IN')} from historical observations.`,
      );
    }
    if (t.entityType === 'broker' && t.brokerActivity >= 1 && t.sampleSize >= 5) {
      const share = Math.round((t.brokerActivity > 0 ? (t.evidence.propertyCount as number) || 0 : 0));
      if (share >= 3) {
        insights.push(
          `Broker ${t.entityLabel} currently represents ${share} tracked listing(s) in the knowledge graph.`,
        );
      }
    }
    if (t.marketActivity >= 5) {
      insights.push(
        `${t.entityLabel} recorded ${t.marketActivity} structured market change event(s) in the trend window.`,
      );
    }
    if (t.priceVolatility != null && t.priceVolatility >= 8) {
      insights.push(
        `${t.entityLabel} shows elevated price volatility (σ≈${t.priceVolatility}%) from observed price changes.`,
      );
    }
    if (t.listingFreshnessDays != null && t.listingFreshnessDays >= 90) {
      insights.push(
        `${t.entityLabel} listings average ${t.listingFreshnessDays} days on market (historical freshness).`,
      );
    }
  }
  return insights;
}

export async function publishInsightNotifications(input: {
  workspaceId: string;
  watchId?: string;
  jobId?: string;
  trends: TrendSnapshot[];
}): Promise<string[]> {
  const insights = buildProactiveInsights(input.trends);
  for (const text of insights.slice(0, 5)) {
    await createNotification({
      workspaceId: input.workspaceId,
      watchId: input.watchId,
      jobId: input.jobId,
      category: 'insight',
      severity: 'info',
      title: 'Market insight',
      body: text,
      evidence: {
        source: 'trend_engine',
        timeline: [{ at: new Date().toISOString(), event: 'proactive_insight' }],
        trends: input.trends.slice(0, 3).map((t) => ({
          entityId: t.entityId,
          entityType: t.entityType,
          entityLabel: t.entityLabel,
          evidence: t.evidence,
          inventoryDeltaPct: t.inventoryDeltaPct,
          averageRentDelta: t.averageRentDelta,
          marketActivity: t.marketActivity,
        })),
      },
    });
  }
  return insights;
}
