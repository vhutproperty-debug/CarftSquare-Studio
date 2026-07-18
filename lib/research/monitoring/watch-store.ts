import { v4 as uuidv4 } from 'uuid';
import { RESEARCH_COLLECTIONS } from '@/lib/research/collections';
import { ensureMonitoringIndexes } from '@/lib/research/monitoring/indexes';
import type {
  ResearchWatch,
  WatchFrequency,
  WatchHealth,
  WatchPolygon,
  WatchPriority,
  WatchScope,
  WatchSearchStrategy,
  WatchStatistics,
  WatchStatus,
} from '@/lib/research/monitoring/types';
import {
  emptyWatchStatistics,
  encryptWatchDefinition,
  hydrateWatch,
  publicWatch,
} from '@/lib/research/monitoring/watch-crypto';
import { ensureResearchIndexes, getResearchDatabase } from '@/lib/research/store';
import type { ResearchPlanCriteria } from '@/lib/research/types';

async function dbReady() {
  const db = await getResearchDatabase();
  await ensureResearchIndexes(db);
  await ensureMonitoringIndexes(db);
  return db;
}

/** Stagger next run so thousands of watches do not fire simultaneously. */
export function computeNextRunAt(
  frequency: WatchFrequency,
  from = new Date(),
  staggerSeed = 0,
): string | undefined {
  if (frequency === 'manual' || frequency === 'event') return undefined;
  const d = new Date(from);
  if (frequency === 'hourly') d.setHours(d.getHours() + 1);
  else if (frequency === 'daily') d.setDate(d.getDate() + 1);
  else if (frequency === 'weekly') d.setDate(d.getDate() + 7);
  else if (frequency === 'monthly') d.setMonth(d.getMonth() + 1);

  // Deterministic stagger 0–14 minutes based on seed
  const staggerMin = Math.abs(staggerSeed) % 15;
  d.setMinutes(d.getMinutes() + staggerMin);
  d.setSeconds((Math.abs(staggerSeed) * 7) % 60);
  return d.toISOString();
}

function seedFromId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i += 1) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h;
}

const DEFAULT_STRATEGY: WatchSearchStrategy = {
  mode: 'adaptive',
  skipUnchangedPortals: true,
  preferKnowledgeGraph: true,
  maxListingsPerPortal: 40,
};

export async function createWatch(input: {
  workspaceId: string;
  createdBy: string;
  name: string;
  scope: WatchScope;
  targetId?: string;
  targetLabel?: string;
  savedSearchId?: string;
  landmark?: string;
  polygon?: WatchPolygon;
  filters?: ResearchPlanCriteria;
  naturalLanguage?: string;
  searchStrategy?: Partial<WatchSearchStrategy>;
  frequency?: WatchFrequency;
  priority?: WatchPriority;
  enabled?: boolean;
}): Promise<ReturnType<typeof publicWatch>> {
  const db = await dbReady();
  const now = new Date().toISOString();
  const id = uuidv4();
  const frequency = input.frequency || 'daily';
  const searchStrategy: WatchSearchStrategy = {
    ...DEFAULT_STRATEGY,
    ...input.searchStrategy,
  };
  const filters = input.filters || { city: 'Mumbai' };
  const encryptedDefinition = encryptWatchDefinition({
    filters,
    naturalLanguage: input.naturalLanguage,
    landmark: input.landmark,
    polygon: input.polygon,
    savedSearchId: input.savedSearchId,
    searchStrategy,
  });

  const enabled = input.enabled !== false;
  const doc: ResearchWatch = {
    id,
    workspaceId: input.workspaceId,
    ownerId: input.createdBy,
    createdBy: input.createdBy,
    name: input.name,
    scope: input.scope,
    targetId: input.targetId,
    targetLabel: input.targetLabel,
    savedSearchId: input.savedSearchId,
    landmark: input.landmark,
    polygon: input.polygon,
    filters,
    encryptedDefinition,
    naturalLanguage: input.naturalLanguage,
    searchStrategy,
    frequency,
    priority: input.priority || 'normal',
    enabled,
    status: enabled ? 'active' : 'paused',
    health: 'idle',
    statistics: emptyWatchStatistics(0),
    nextRunAt: computeNextRunAt(frequency, new Date(), seedFromId(id)),
    runCount: 0,
    createdAt: now,
    updatedAt: now,
  };
  await db.collection(RESEARCH_COLLECTIONS.watches).insertOne(doc);
  return publicWatch(doc);
}

export async function getWatchById(id: string): Promise<ResearchWatch | null> {
  const db = await dbReady();
  const doc = await db.collection<ResearchWatch>(RESEARCH_COLLECTIONS.watches).findOne({ id });
  return doc ? hydrateWatch(doc) : null;
}

export async function listWatches(
  workspaceId: string,
  opts?: { status?: WatchStatus; enabled?: boolean },
): Promise<Array<ReturnType<typeof publicWatch>>> {
  const db = await dbReady();
  const filter: Record<string, unknown> = { workspaceId };
  if (opts?.status) filter.status = opts.status;
  if (opts?.enabled != null) filter.enabled = opts.enabled;
  const rows = await db
    .collection<ResearchWatch>(RESEARCH_COLLECTIONS.watches)
    .find(filter)
    .sort({ priority: -1, updatedAt: -1 })
    .limit(2000)
    .toArray();
  return rows.map((r) => publicWatch(r));
}

export async function updateWatch(
  id: string,
  patch: Partial<
    Pick<
      ResearchWatch,
      | 'name'
      | 'filters'
      | 'naturalLanguage'
      | 'frequency'
      | 'priority'
      | 'status'
      | 'enabled'
      | 'lastRunAt'
      | 'nextRunAt'
      | 'lastJobId'
      | 'lastError'
      | 'lastChangeDetectedAt'
      | 'runCount'
      | 'targetLabel'
      | 'health'
      | 'statistics'
      | 'searchStrategy'
      | 'landmark'
      | 'polygon'
      | 'savedSearchId'
    >
  >,
): Promise<ResearchWatch | null> {
  const db = await dbReady();
  const existing = await getWatchById(id);
  if (!existing) return null;

  const nextFilters = patch.filters || existing.filters;
  const nextStrategy = patch.searchStrategy || existing.searchStrategy;
  const nextNl = patch.naturalLanguage !== undefined ? patch.naturalLanguage : existing.naturalLanguage;
  const nextLandmark = patch.landmark !== undefined ? patch.landmark : existing.landmark;
  const nextPolygon = patch.polygon !== undefined ? patch.polygon : existing.polygon;
  const nextSaved = patch.savedSearchId !== undefined ? patch.savedSearchId : existing.savedSearchId;

  const next: Record<string, unknown> = {
    ...patch,
    updatedAt: new Date().toISOString(),
  };

  if (
    patch.filters ||
    patch.naturalLanguage !== undefined ||
    patch.searchStrategy ||
    patch.landmark !== undefined ||
    patch.polygon !== undefined ||
    patch.savedSearchId !== undefined
  ) {
    next.encryptedDefinition = encryptWatchDefinition({
      filters: nextFilters,
      naturalLanguage: nextNl,
      landmark: nextLandmark,
      polygon: nextPolygon,
      savedSearchId: nextSaved,
      searchStrategy: nextStrategy,
    });
    next.filters = nextFilters;
    next.searchStrategy = nextStrategy;
  }

  if (patch.enabled === false) {
    next.status = 'paused';
    next.enabled = false;
  } else if (patch.enabled === true) {
    next.enabled = true;
    if (!patch.status) next.status = 'active';
  }

  if (patch.status === 'paused' || patch.status === 'disabled') {
    next.enabled = false;
  } else if (patch.status === 'active') {
    next.enabled = true;
  }

  if (patch.frequency && patch.frequency !== 'manual' && patch.frequency !== 'event' && !patch.nextRunAt) {
    next.nextRunAt = computeNextRunAt(patch.frequency, new Date(), seedFromId(id));
  }

  const unset: Record<string, ''> = {};
  if ('lastError' in patch && (patch.lastError == null || patch.lastError === '')) {
    delete next.lastError;
    unset.lastError = '';
  }

  await db.collection(RESEARCH_COLLECTIONS.watches).updateOne(
    { id },
    {
      $set: next,
      ...(Object.keys(unset).length ? { $unset: unset } : {}),
    },
  );
  return getWatchById(id);
}

export async function listDueWatches(limit = 20): Promise<ResearchWatch[]> {
  const db = await dbReady();
  const now = new Date().toISOString();
  const rows = await db
    .collection<ResearchWatch>(RESEARCH_COLLECTIONS.watches)
    .find({
      $and: [
        { status: 'active' },
        { $or: [{ enabled: true }, { enabled: { $exists: false } }] },
        { frequency: { $nin: ['manual', 'event'] } },
        { nextRunAt: { $lte: now } },
      ],
    })
    .sort({ priority: -1, nextRunAt: 1 })
    .limit(limit)
    .toArray();
  return rows.map((r) => hydrateWatch(r));
}

/** Event-triggered due marker (connector reconnect, KG spike, manual event). */
export async function markWatchEventDue(watchId: string): Promise<ResearchWatch | null> {
  const db = await dbReady();
  const now = new Date().toISOString();
  await db.collection(RESEARCH_COLLECTIONS.watches).updateOne(
    { id: watchId },
    { $set: { nextRunAt: now, updatedAt: now } },
  );
  return getWatchById(watchId);
}

export async function deleteWatch(id: string, workspaceId: string): Promise<boolean> {
  const db = await dbReady();
  const res = await db.collection(RESEARCH_COLLECTIONS.watches).deleteOne({ id, workspaceId });
  return res.deletedCount === 1;
}

export function deriveWatchHealth(stats: WatchStatistics, lastError?: string): WatchHealth {
  if (lastError && stats.failedRuns > 0 && stats.successfulRuns === 0) return 'failing';
  if (stats.totalRuns === 0) return 'idle';
  const failRate = stats.totalRuns ? stats.failedRuns / stats.totalRuns : 0;
  if (failRate >= 0.5) return 'failing';
  if (failRate >= 0.2 || lastError) return 'degraded';
  return 'healthy';
}
