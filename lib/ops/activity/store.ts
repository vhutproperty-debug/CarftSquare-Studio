import { v4 as uuidv4 } from 'uuid';
import type { Db } from 'mongodb';
// @ts-expect-error JS module without types
import { getDb } from '@/lib/mongodb';
import type { OpsLeadSource } from '@/lib/ops/leads/types';

const COLLECTION = 'ops_activity_logs';

export type OpsActivityAction =
  | 'view_dashboard'
  | 'view_leads_inbox'
  | 'view_lead_detail';

export type OpsActivityLog = {
  id: string;
  action: OpsActivityAction;
  actorId: string;
  actorEmail: string;
  resource: string;
  resourceId?: string;
  details?: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
  createdAt: string;
};

let indexesEnsured = false;

export async function ensureOpsActivityIndexes(db: Db): Promise<void> {
  if (indexesEnsured) return;
  await db.collection(COLLECTION).createIndex({ id: 1 }, { unique: true });
  await db.collection(COLLECTION).createIndex({ createdAt: -1 });
  await db.collection(COLLECTION).createIndex({ actorId: 1, createdAt: -1 });
  await db.collection(COLLECTION).createIndex({ action: 1, createdAt: -1 });
  indexesEnsured = true;
}

function getRequestMeta(request?: Request) {
  if (!request) return { ip: undefined, userAgent: undefined };
  return {
    ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip')
      || undefined,
    userAgent: request.headers.get('user-agent') || undefined,
  };
}

export async function logOpsActivity(
  payload: {
    action: OpsActivityAction;
    actorId: string;
    actorEmail: string;
    resource: string;
    resourceId?: string;
    details?: Record<string, unknown>;
    request?: Request;
  },
  db?: Db,
): Promise<void> {
  try {
    const database = db || await getDb();
    await ensureOpsActivityIndexes(database);
    const meta = getRequestMeta(payload.request);
    const entry: OpsActivityLog = {
      id: uuidv4(),
      action: payload.action,
      actorId: payload.actorId,
      actorEmail: payload.actorEmail,
      resource: payload.resource,
      resourceId: payload.resourceId,
      details: payload.details,
      ip: meta.ip,
      userAgent: meta.userAgent,
      createdAt: new Date().toISOString(),
    };
    await database.collection(COLLECTION).insertOne(entry);
  } catch (error) {
    console.error('[ops-activity] log_failed', error instanceof Error ? error.message : error);
  }
}

export function leadDetailResource(source: OpsLeadSource, id: string): string {
  return `ops_lead:${source}:${id}`;
}
