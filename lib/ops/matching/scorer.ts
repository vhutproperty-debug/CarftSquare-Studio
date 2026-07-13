import type { MatchProfile } from '@/lib/ops/matching/types';
import { profilesCompatible } from '@/lib/ops/matching/profiles';

export type MatchScoreResult = {
  score: number;
  reasons: string[];
};

function includesEither(a: string, b: string): boolean {
  if (!a || !b) return false;
  return a.includes(b) || b.includes(a);
}

function scoreConfiguration(demand: MatchProfile, supply: MatchProfile): { points: number; reason?: string } {
  const max = 25;
  if (!demand.configuration || !supply.configuration) return { points: 8, reason: 'Configuration pending' };
  if (demand.configuration === supply.configuration) return { points: max, reason: 'Configuration match' };
  const dNum = demand.configuration.match(/(\d)/)?.[1];
  const sNum = supply.configuration.match(/(\d)/)?.[1];
  if (dNum && sNum && dNum === sNum) return { points: 18, reason: 'Same BHK count' };
  if (includesEither(demand.configuration, supply.configuration)) return { points: 12, reason: 'Similar configuration' };
  return { points: 0 };
}

function scoreBudget(demand: MatchProfile, supply: MatchProfile): { points: number; reason?: string } {
  const max = 25;
  if (demand.budget == null || supply.budget == null) return { points: 10, reason: 'Budget to confirm' };
  const diff = Math.abs(demand.budget - supply.budget) / Math.max(demand.budget, supply.budget);
  if (diff <= 0.1) return { points: max, reason: 'Budget match' };
  if (diff <= 0.25) return { points: 18, reason: 'Budget within 25%' };
  if (diff <= 0.5) return { points: 10, reason: 'Budget within 50%' };
  return { points: 0 };
}

function scoreProject(demand: MatchProfile, supply: MatchProfile): { points: number; reason?: string } {
  const max = 15;
  if (!demand.project || !supply.project) return { points: 4 };
  if (demand.project === supply.project) return { points: max, reason: 'Same project' };
  if (includesEither(demand.project, supply.project)) return { points: 8, reason: 'Similar project' };
  return { points: 0 };
}

function scoreBuilding(demand: MatchProfile, supply: MatchProfile): { points: number; reason?: string } {
  const max = 10;
  const target = demand.building || demand.areaPreference;
  if (!target || !supply.building) return { points: 3 };
  if (target === supply.building) return { points: max, reason: 'Same building / area' };
  if (includesEither(target, supply.building)) return { points: 6, reason: 'Nearby building / area' };
  return { points: 0 };
}

function scoreAvailability(supply: MatchProfile): { points: number; reason?: string } {
  const max = 10;
  const timeline = supply.timeline || '';
  if (timeline.includes('immediate') || timeline.includes('ready') || timeline.includes('available')) {
    return { points: max, reason: 'Available immediately' };
  }
  if (timeline) return { points: 6, reason: 'Availability known' };
  return { points: 3 };
}

function scoreFurnishing(demand: MatchProfile, supply: MatchProfile): { points: number; reason?: string } {
  const max = 8;
  if (!demand.furnishing || !supply.furnishing) return { points: 2 };
  if (demand.furnishing === supply.furnishing) return { points: max, reason: 'Furnishing match' };
  if (includesEither(demand.furnishing, supply.furnishing)) return { points: 5, reason: 'Similar furnishing' };
  if (demand.furnishing.includes('furnish') && supply.furnishing.includes('furnish')) {
    return { points: max, reason: 'Fully furnished' };
  }
  return { points: 0 };
}

function scoreParking(demand: MatchProfile, supply: MatchProfile): { points: number; reason?: string } {
  const max = 4;
  if (!demand.parking || !supply.parking) return { points: 1 };
  if (includesEither(demand.parking, supply.parking)) return { points: max, reason: 'Parking aligned' };
  return { points: 0 };
}

function scoreTimeline(demand: MatchProfile, supply: MatchProfile): { points: number; reason?: string } {
  const max = 3;
  if (!demand.timeline || !supply.timeline) return { points: 1 };
  if (includesEither(demand.timeline, supply.timeline)) return { points: max, reason: 'Timeline aligned' };
  return { points: 0 };
}

export const MIN_MATCH_SCORE = 35;

export function computeMatchScore(demand: MatchProfile, supply: MatchProfile): MatchScoreResult {
  if (!profilesCompatible(demand, supply)) {
    return { score: 0, reasons: ['Transaction type mismatch'] };
  }

  const parts = [
    scoreConfiguration(demand, supply),
    scoreBudget(demand, supply),
    scoreProject(demand, supply),
    scoreBuilding(demand, supply),
    scoreAvailability(supply),
    scoreFurnishing(demand, supply),
    scoreParking(demand, supply),
    scoreTimeline(demand, supply),
  ];

  const score = Math.min(100, Math.round(parts.reduce((sum, p) => sum + p.points, 0)));
  const reasons = parts.map((p) => p.reason).filter((r): r is string => Boolean(r));

  if (demand.transactionType && supply.transactionType && demand.transactionType === supply.transactionType) {
    reasons.unshift(demand.transactionType === 'rent' ? 'Rental match' : 'Sale match');
  }

  return { score, reasons: reasons.slice(0, 6) };
}
