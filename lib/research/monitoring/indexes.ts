import type { Db } from 'mongodb';
import { RESEARCH_COLLECTIONS } from '@/lib/research/collections';

export async function ensureMonitoringIndexes(db: Db): Promise<void> {
  await Promise.all([
    db.collection(RESEARCH_COLLECTIONS.watches).createIndex({ id: 1 }, { unique: true }),
    db.collection(RESEARCH_COLLECTIONS.watches).createIndex({ workspaceId: 1, status: 1 }),
    db.collection(RESEARCH_COLLECTIONS.watches).createIndex({ workspaceId: 1, nextRunAt: 1 }),
    db.collection(RESEARCH_COLLECTIONS.watches).createIndex({ workspaceId: 1, priority: 1 }),

    db.collection(RESEARCH_COLLECTIONS.watchJobs).createIndex({ id: 1 }, { unique: true }),
    db.collection(RESEARCH_COLLECTIONS.watchJobs).createIndex({
      workspaceId: 1,
      status: 1,
      scheduledFor: 1,
    }),
    db.collection(RESEARCH_COLLECTIONS.watchJobs).createIndex({ watchId: 1, createdAt: -1 }),
    db.collection(RESEARCH_COLLECTIONS.watchJobs).createIndex({
      status: 1,
      priority: 1,
      scheduledFor: 1,
    }),

    db.collection(RESEARCH_COLLECTIONS.notifications).createIndex({ id: 1 }, { unique: true }),
    db.collection(RESEARCH_COLLECTIONS.notifications).createIndex({
      workspaceId: 1,
      read: 1,
      createdAt: -1,
    }),
    db.collection(RESEARCH_COLLECTIONS.notifications).createIndex({
      workspaceId: 1,
      category: 1,
      createdAt: -1,
    }),
    db.collection(RESEARCH_COLLECTIONS.notifications).createIndex({
      workspaceId: 1,
      severity: 1,
    }),

    db.collection(RESEARCH_COLLECTIONS.trends).createIndex({ id: 1 }, { unique: true }),
    db.collection(RESEARCH_COLLECTIONS.trends).createIndex({
      workspaceId: 1,
      entityType: 1,
      entityId: 1,
      computedAt: -1,
    }),

    db.collection(RESEARCH_COLLECTIONS.monitorAudits).createIndex({ id: 1 }, { unique: true }),
    db.collection(RESEARCH_COLLECTIONS.monitorAudits).createIndex({
      workspaceId: 1,
      createdAt: -1,
    }),

    db.collection(RESEARCH_COLLECTIONS.watches).createIndex({ workspaceId: 1, enabled: 1 }),
    db.collection(RESEARCH_COLLECTIONS.watches).createIndex({ workspaceId: 1, ownerId: 1 }),
    db.collection(RESEARCH_COLLECTIONS.watches).createIndex({
      workspaceId: 1,
      scope: 1,
      status: 1,
    }),

    db.collection(RESEARCH_COLLECTIONS.notifications).createIndex({
      workspaceId: 1,
      archived: 1,
      createdAt: -1,
    }),
    db.collection(RESEARCH_COLLECTIONS.notifications).createIndex({
      workspaceId: 1,
      priority: 1,
      createdAt: -1,
    }),

    db.collection(RESEARCH_COLLECTIONS.workerHeartbeats).createIndex({ id: 1 }, { unique: true }),
    db.collection(RESEARCH_COLLECTIONS.workerHeartbeats).createIndex(
      { workerId: 1, workerType: 1 },
      { unique: true },
    ),
    db.collection(RESEARCH_COLLECTIONS.workerHeartbeats).createIndex({ lastHeartbeatAt: -1 }),

    db.collection(RESEARCH_COLLECTIONS.monitorMetrics).createIndex({ id: 1 }, { unique: true }),
    db.collection(RESEARCH_COLLECTIONS.monitorMetrics).createIndex({
      workspaceId: 1,
      at: -1,
    }),
  ]);
}
