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
  status: 'pending' | 'active' | 'done' | 'fail';
  portal?: string;
  count?: number;
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

/**
 * Live timeline from server-emitted activity only.
 * Never fabricates portal/progress steps when activity is empty.
 */
export function buildLiveResearchSteps(
  progress: ResearchAiProgress | null | undefined,
  busy: boolean,
): LiveStep[] {
  const activity = progress?.activity;
  if (!activity?.length) return [];

  return activity.map((ev, index) => {
    const isLast = index === activity.length - 1;
    let status: LiveStep['status'] = 'done';
    if (ev.status === 'fail') status = 'fail';
    else if (ev.status === 'running' || (busy && isLast && ev.status !== 'ok')) {
      status = 'active';
    } else if (ev.status === 'ok' || ev.status === 'info') {
      status = 'done';
    }
    return {
      id: ev.id,
      label: ev.message,
      status,
      portal: ev.portal,
      count: ev.count,
    };
  });
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
