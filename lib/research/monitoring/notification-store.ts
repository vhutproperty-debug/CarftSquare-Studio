import { v4 as uuidv4 } from 'uuid';
import { RESEARCH_COLLECTIONS } from '@/lib/research/collections';
import { ensureMonitoringIndexes } from '@/lib/research/monitoring/indexes';
import type {
  AlertCategory,
  AlertSeverity,
  NotificationPriority,
  ResearchNotification,
} from '@/lib/research/monitoring/types';
import { ensureResearchIndexes, getResearchDatabase } from '@/lib/research/store';

async function dbReady() {
  const db = await getResearchDatabase();
  await ensureResearchIndexes(db);
  await ensureMonitoringIndexes(db);
  return db;
}

function severityToPriority(severity: AlertSeverity): NotificationPriority {
  if (severity === 'critical') return 'urgent';
  if (severity === 'high') return 'high';
  if (severity === 'medium') return 'normal';
  return 'low';
}

export async function createNotification(input: {
  workspaceId: string;
  watchId?: string;
  jobId?: string;
  category: AlertCategory;
  severity: AlertSeverity;
  priority?: NotificationPriority;
  title: string;
  body: string;
  propertyId?: string;
  projectId?: string;
  brokerId?: string;
  localityId?: string;
  builderId?: string;
  evidence: Record<string, unknown>;
}): Promise<ResearchNotification> {
  const db = await dbReady();
  const now = new Date().toISOString();
  const doc: ResearchNotification = {
    id: uuidv4(),
    workspaceId: input.workspaceId,
    watchId: input.watchId,
    jobId: input.jobId,
    category: input.category,
    severity: input.severity,
    priority: input.priority || severityToPriority(input.severity),
    title: input.title,
    body: input.body,
    read: false,
    archived: false,
    propertyId: input.propertyId,
    projectId: input.projectId,
    brokerId: input.brokerId,
    localityId: input.localityId,
    builderId: input.builderId,
    evidence: input.evidence,
    createdAt: now,
    updatedAt: now,
  };
  await db.collection(RESEARCH_COLLECTIONS.notifications).insertOne(doc);
  return doc;
}

export async function listNotifications(
  workspaceId: string,
  opts?: {
    read?: boolean;
    archived?: boolean;
    category?: AlertCategory;
    severity?: AlertSeverity;
    priority?: NotificationPriority;
    q?: string;
    limit?: number;
  },
): Promise<ResearchNotification[]> {
  const db = await dbReady();
  const filter: Record<string, unknown> = { workspaceId };
  if (opts?.read != null) filter.read = opts.read;
  if (opts?.archived != null) filter.archived = opts.archived;
  else filter.archived = { $ne: true };
  if (opts?.category) filter.category = opts.category;
  if (opts?.severity) filter.severity = opts.severity;
  if (opts?.priority) filter.priority = opts.priority;
  if (opts?.q?.trim()) {
    filter.$or = [
      { title: { $regex: opts.q.trim(), $options: 'i' } },
      { body: { $regex: opts.q.trim(), $options: 'i' } },
    ];
  }
  return db
    .collection<ResearchNotification>(RESEARCH_COLLECTIONS.notifications)
    .find(filter)
    .sort({ createdAt: -1 })
    .limit(opts?.limit || 100)
    .toArray();
}

export async function getNotificationById(id: string): Promise<ResearchNotification | null> {
  const db = await dbReady();
  return db.collection<ResearchNotification>(RESEARCH_COLLECTIONS.notifications).findOne({ id });
}

export async function markNotificationRead(
  id: string,
  workspaceId: string,
  read = true,
): Promise<ResearchNotification | null> {
  const db = await dbReady();
  await db.collection(RESEARCH_COLLECTIONS.notifications).updateOne(
    { id, workspaceId },
    { $set: { read, updatedAt: new Date().toISOString() } },
  );
  return getNotificationById(id);
}

export async function archiveNotification(
  id: string,
  workspaceId: string,
  archived = true,
): Promise<ResearchNotification | null> {
  const db = await dbReady();
  await db.collection(RESEARCH_COLLECTIONS.notifications).updateOne(
    { id, workspaceId },
    { $set: { archived, read: true, updatedAt: new Date().toISOString() } },
  );
  return getNotificationById(id);
}

export async function bulkUpdateNotifications(input: {
  workspaceId: string;
  ids: string[];
  action: 'read' | 'unread' | 'archive' | 'unarchive';
}): Promise<number> {
  const db = await dbReady();
  const now = new Date().toISOString();
  const set: Record<string, unknown> = { updatedAt: now };
  if (input.action === 'read') set.read = true;
  if (input.action === 'unread') set.read = false;
  if (input.action === 'archive') {
    set.archived = true;
    set.read = true;
  }
  if (input.action === 'unarchive') set.archived = false;
  const res = await db.collection(RESEARCH_COLLECTIONS.notifications).updateMany(
    { workspaceId: input.workspaceId, id: { $in: input.ids } },
    { $set: set },
  );
  return res.modifiedCount;
}

export async function countUnread(workspaceId: string): Promise<number> {
  const db = await dbReady();
  return db.collection(RESEARCH_COLLECTIONS.notifications).countDocuments({
    workspaceId,
    read: false,
    archived: { $ne: true },
  });
}
