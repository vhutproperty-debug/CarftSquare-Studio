import { RESEARCH_COLLECTIONS } from '@/lib/research/collections';
import { resolveCanonicalName } from '@/lib/research/graph/aliases';
import type { KgObservation, KgProperty } from '@/lib/research/graph/types';
import type { ResearchWatch } from '@/lib/research/monitoring/types';
import { ensureResearchIndexes, getResearchDatabase } from '@/lib/research/store';
import type { ResearchPlanCriteria } from '@/lib/research/types';

export type DeltaBaseline = {
  knownProperties: KgProperty[];
  lastObservationByProperty: Record<string, KgObservation>;
  knownListingKeys: Set<string>;
  criteria: ResearchPlanCriteria;
};

/**
 * Build crawl criteria + known state from Knowledge Graph before browser work.
 */
export async function buildDeltaBaseline(watch: ResearchWatch): Promise<DeltaBaseline> {
  const db = await getResearchDatabase();
  await ensureResearchIndexes(db);

  const criteria: ResearchPlanCriteria = { ...watch.filters, city: watch.filters.city || 'Mumbai' };

  if (watch.scope === 'project' && (watch.targetLabel || criteria.project)) {
    const name = await resolveCanonicalName(
      watch.workspaceId,
      'project',
      watch.targetLabel || criteria.project || '',
    );
    criteria.project = name;
  }
  if (watch.scope === 'locality' && (watch.targetLabel || criteria.locality)) {
    criteria.locality = await resolveCanonicalName(
      watch.workspaceId,
      'locality',
      watch.targetLabel || criteria.locality || '',
    );
  }
  if (watch.scope === 'broker' && watch.targetLabel) {
    criteria.keywords = Array.from(
      new Set([...(criteria.keywords || []), watch.targetLabel]),
    );
  }
  if (watch.scope === 'builder' && (watch.targetLabel || criteria.keywords?.length)) {
    criteria.keywords = Array.from(
      new Set([...(criteria.keywords || []), watch.targetLabel || ''].filter(Boolean)),
    );
  }
  if (watch.scope === 'landmark' && (watch.landmark || watch.targetLabel)) {
    const landmark = watch.landmark || watch.targetLabel || '';
    criteria.locality = criteria.locality || landmark;
    criteria.keywords = Array.from(new Set([...(criteria.keywords || []), landmark]));
  }
  if (watch.scope === 'polygon' && watch.polygon?.label) {
    criteria.keywords = Array.from(
      new Set([...(criteria.keywords || []), watch.polygon.label]),
    );
  }
  if (watch.scope === 'saved_search' && watch.savedSearchId) {
    const saved = await db.collection(RESEARCH_COLLECTIONS.savedSearches).findOne({
      id: watch.savedSearchId,
      workspaceId: watch.workspaceId,
    });
    if (saved && typeof saved === 'object' && saved.filters) {
      Object.assign(criteria, saved.filters as ResearchPlanCriteria);
    }
  }
  if (watch.naturalLanguage && !criteria.project && !criteria.locality && !criteria.bhk) {
    criteria.keywords = Array.from(
      new Set([...(criteria.keywords || []), watch.naturalLanguage.slice(0, 80)]),
    );
  }

  const filter: Record<string, unknown> = {
    workspaceId: watch.workspaceId,
    status: { $in: ['active', 'relisted', 'unknown'] },
  };
  if (watch.scope === 'property' && watch.targetId) {
    filter.id = watch.targetId;
  } else if (criteria.project) {
    filter.projectName = { $regex: criteria.project.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
  } else if (criteria.locality) {
    // soft locality match via title/project
    filter.$or = [
      { title: { $regex: criteria.locality, $options: 'i' } },
      { projectName: { $regex: criteria.locality, $options: 'i' } },
    ];
  }
  if (criteria.bhk != null) filter.bhk = criteria.bhk;

  const knownProperties = await db
    .collection<KgProperty>(RESEARCH_COLLECTIONS.kgProperties)
    .find(filter)
    .sort({ lastSeenAt: -1 })
    .limit(300)
    .toArray();

  const propertyIds = knownProperties.map((p) => p.id);
  const observations = propertyIds.length
    ? await db
        .collection<KgObservation>(RESEARCH_COLLECTIONS.kgObservations)
        .find({ workspaceId: watch.workspaceId, propertyId: { $in: propertyIds } })
        .sort({ observedAt: -1 })
        .limit(1000)
        .toArray()
    : [];

  const lastObservationByProperty: Record<string, KgObservation> = {};
  for (const obs of observations) {
    if (!lastObservationByProperty[obs.propertyId]) {
      lastObservationByProperty[obs.propertyId] = obs;
    }
  }

  const knownListingKeys = new Set<string>();
  for (const p of knownProperties) {
    for (const url of p.portalUrls || []) knownListingKeys.add(`url:${url}`);
    for (const portal of p.portalKeys || []) knownListingKeys.add(`portal:${portal}:${p.identity.fingerprint}`);
    knownListingKeys.add(`fp:${p.identity.fingerprint}`);
  }

  return {
    knownProperties,
    lastObservationByProperty,
    knownListingKeys,
    criteria,
  };
}

export function classifyListingDelta(
  listing: { id: string; url?: string; rent?: number; salePrice?: number; portal: string },
  baseline: DeltaBaseline,
): 'new' | 'changed' | 'unchanged' {
  const urlKey = listing.url ? `url:${listing.url}` : '';
  const known = baseline.knownProperties.find(
    (p) =>
      (listing.url && p.portalUrls.includes(listing.url))
      || p.portalKeys.includes(listing.portal),
  );

  if (!known && !(urlKey && baseline.knownListingKeys.has(urlKey))) {
    return 'new';
  }

  if (known) {
    const last = baseline.lastObservationByProperty[known.id];
    const prevPrice = last?.rent ?? known.rent;
    const nextPrice = listing.rent ?? listing.salePrice;
    if (prevPrice != null && nextPrice != null && prevPrice !== nextPrice) return 'changed';
    return 'unchanged';
  }

  return 'unchanged';
}
