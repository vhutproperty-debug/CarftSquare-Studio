/**
 * Presentation helpers for the premium AI research workspace (UI only).
 */

import type { ResearchAiProgress } from '@/lib/research/types';

export const RESEARCH_SUGGESTED_PROMPTS = [
  'Find owner listings in Andheri West',
  'Compare Oberoi Sky City vs Lodha Park',
  'Show distressed resale inventory',
  'Rental yield in Borivali East',
  'Show broker inventory in Goregaon',
  'Find 2 BHK rentals below ₹80,000 in Oberoi Sky City',
] as const;

export type LiveStep = {
  id: string;
  label: string;
  status: 'pending' | 'active' | 'done';
};

export function formatResearchMoney(n?: number): string {
  if (n == null) return '—';
  return `₹${n.toLocaleString('en-IN')}`;
}

export function daysOnMarket(postedAt?: string, freshnessHours?: number): string {
  if (typeof freshnessHours === 'number' && Number.isFinite(freshnessHours)) {
    const days = Math.max(0, Math.round(freshnessHours / 24));
    if (days <= 0) return 'Today';
    if (days === 1) return '1 day';
    return `${days} days`;
  }
  if (!postedAt) return '—';
  const t = new Date(postedAt).getTime();
  if (!Number.isFinite(t)) return '—';
  const days = Math.max(0, Math.floor((Date.now() - t) / 86_400_000));
  if (days <= 0) return 'Today';
  if (days === 1) return '1 day';
  return `${days} days`;
}

export function buildLiveResearchSteps(
  progress: ResearchAiProgress | null | undefined,
  busy: boolean,
): LiveStep[] {
  if (!busy && (!progress || progress.phase === 'idle' || progress.phase === 'completed')) {
    return [];
  }
  const phase = progress?.phase || 'understanding';
  const portalsDone = progress?.portalsDone ?? 0;
  const portalsTotal = Math.max(progress?.portalsTotal ?? 5, 1);
  const message = (progress?.message || '').toLowerCase();

  const portalLabels = ['Housing.com', 'MagicBricks', '99acres', 'NoBroker', 'Square Yards'];
  const steps: LiveStep[] = [
    {
      id: 'understand',
      label: 'Understanding your brief…',
      status: phase === 'understanding' || phase === 'planning' ? 'active' : 'done',
    },
  ];

  portalLabels.forEach((name, index) => {
    let status: LiveStep['status'] = 'pending';
    if (phase === 'searching') {
      if (index < portalsDone) status = 'done';
      else if (index === portalsDone) status = 'active';
    } else if (phase === 'analyzing' || phase === 'reporting' || phase === 'completed') {
      status = 'done';
    }
    steps.push({ id: `portal-${name}`, label: `Searching ${name}…`, status });
  });

  const afterSearch =
    phase === 'analyzing' || phase === 'reporting' || phase === 'completed'
      ? 'active'
      : phase === 'searching' && portalsDone >= portalsTotal
        ? 'active'
        : 'pending';

  steps.push({
    id: 'dedupe',
    label: 'Removing duplicates…',
    status:
      /dedup|duplicate/i.test(message) || phase === 'analyzing'
        ? afterSearch === 'active'
          ? 'active'
          : phase === 'reporting' || phase === 'completed'
            ? 'done'
            : 'pending'
        : phase === 'reporting' || phase === 'completed'
          ? 'done'
          : 'pending',
  });
  steps.push({
    id: 'compare',
    label: 'Comparing prices…',
    status:
      phase === 'analyzing' && /score|compar|price|knowledge/i.test(message)
        ? 'active'
        : phase === 'reporting' || phase === 'completed'
          ? 'done'
          : 'pending',
  });
  steps.push({
    id: 'history',
    label: 'Checking historical records…',
    status:
      /knowledge graph|historical|graph/i.test(message)
        ? 'active'
        : phase === 'reporting' || phase === 'completed'
          ? 'done'
          : 'pending',
  });
  steps.push({
    id: 'intel',
    label: 'Building market intelligence…',
    status: phase === 'reporting' ? 'active' : phase === 'completed' ? 'done' : 'pending',
  });
  steps.push({
    id: 'exec',
    label: 'Preparing executive summary…',
    status: phase === 'completed' ? 'done' : phase === 'reporting' ? 'active' : 'pending',
  });

  if (busy) {
    const firstPending = steps.findIndex((s) => s.status === 'pending');
    const hasActive = steps.some((s) => s.status === 'active');
    if (!hasActive && firstPending >= 0) {
      steps[firstPending] = { ...steps[firstPending], status: 'active' };
    }
  }

  return steps;
}

export type SessionTimeGroup = 'today' | 'yesterday' | 'last_week' | 'older';

export function sessionTimeGroup(iso?: string): SessionTimeGroup {
  if (!iso) return 'older';
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return 'older';
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startYesterday = startToday - 86_400_000;
  const startWeek = startToday - 7 * 86_400_000;
  if (t >= startToday) return 'today';
  if (t >= startYesterday) return 'yesterday';
  if (t >= startWeek) return 'last_week';
  return 'older';
}

export const SESSION_GROUP_LABEL: Record<SessionTimeGroup, string> = {
  today: 'Today',
  yesterday: 'Yesterday',
  last_week: 'Last Week',
  older: 'Earlier',
};
