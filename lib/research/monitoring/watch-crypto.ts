import { decryptResearchPayload, encryptResearchPayload } from '@/lib/research/crypto';
import type { ResearchWatch, WatchPolygon, WatchSearchStrategy } from '@/lib/research/monitoring/types';
import type { ResearchPlanCriteria } from '@/lib/research/types';

export type WatchDefinitionPayload = {
  filters: ResearchPlanCriteria;
  naturalLanguage?: string;
  landmark?: string;
  polygon?: WatchPolygon;
  savedSearchId?: string;
  searchStrategy: WatchSearchStrategy;
};

export function encryptWatchDefinition(payload: WatchDefinitionPayload): string {
  return encryptResearchPayload(payload);
}

export function decryptWatchDefinition(encoded: string): WatchDefinitionPayload {
  return decryptResearchPayload<WatchDefinitionPayload>(encoded);
}

/** Hydrate a stored watch document so callers always see decrypted criteria. */
export function hydrateWatch(doc: ResearchWatch): ResearchWatch {
  if (!doc.encryptedDefinition) {
    return {
      ...doc,
      ownerId: doc.ownerId || doc.createdBy,
      enabled: doc.enabled ?? (doc.status === 'active'),
      health: doc.health || 'unknown',
      searchStrategy: doc.searchStrategy || {
        mode: 'adaptive',
        skipUnchangedPortals: true,
        preferKnowledgeGraph: true,
      },
      statistics: doc.statistics || emptyWatchStatistics(doc.runCount || 0),
    };
  }
  try {
    const def = decryptWatchDefinition(doc.encryptedDefinition);
    return {
      ...doc,
      ownerId: doc.ownerId || doc.createdBy,
      enabled: doc.enabled ?? (doc.status === 'active'),
      health: doc.health || 'unknown',
      filters: def.filters || doc.filters,
      naturalLanguage: def.naturalLanguage ?? doc.naturalLanguage,
      landmark: def.landmark ?? doc.landmark,
      polygon: def.polygon ?? doc.polygon,
      savedSearchId: def.savedSearchId ?? doc.savedSearchId,
      searchStrategy: def.searchStrategy || doc.searchStrategy || {
        mode: 'adaptive',
        skipUnchangedPortals: true,
        preferKnowledgeGraph: true,
      },
      statistics: doc.statistics || emptyWatchStatistics(doc.runCount || 0),
    };
  } catch {
    return {
      ...doc,
      ownerId: doc.ownerId || doc.createdBy,
      enabled: doc.enabled ?? (doc.status === 'active'),
      health: doc.health || 'failing',
      searchStrategy: doc.searchStrategy || { mode: 'adaptive' },
      statistics: doc.statistics || emptyWatchStatistics(doc.runCount || 0),
    };
  }
}

export function emptyWatchStatistics(totalRuns = 0) {
  return {
    totalRuns,
    successfulRuns: 0,
    failedRuns: 0,
    totalNewListings: 0,
    totalChangedListings: 0,
    totalRemovedListings: 0,
    totalAlerts: 0,
    lastFetched: 0,
    avgDurationMs: null as number | null,
  };
}

/** Public API shape — never expose ciphertext. */
export function publicWatch(watch: ResearchWatch): Omit<ResearchWatch, 'encryptedDefinition'> {
  const hydrated = hydrateWatch(watch);
  const { encryptedDefinition: _drop, ...rest } = hydrated;
  return rest;
}
