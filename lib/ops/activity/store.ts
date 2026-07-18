import { v4 as uuidv4 } from 'uuid';
import type { Db } from 'mongodb';
// @ts-expect-error JS module without types
import { getDb } from '@/lib/mongodb';
import type { OpsLeadSource } from '@/lib/ops/leads/types';

const COLLECTION = 'ops_activity_logs';

export type OpsActivityAction =
  | 'view_dashboard'
  | 'view_leads_inbox'
  | 'view_lead_detail'
  | 'view_demand_workspace'
  | 'update_demand_record'
  | 'view_supply_workspace'
  | 'view_supply_record'
  | 'create_supply_record'
  | 'update_supply_record'
  | 'view_matching_workspace'
  | 'view_match_record'
  | 'generate_matches'
  | 'update_match_record'
  | 'view_deal_workspace'
  | 'view_deal_record'
  | 'create_deal_record'
  | 'update_deal_record'
  | 'view_revenue_workspace'
  | 'sync_revenue_records'
  | 'update_revenue_record'
  | 'view_agreement_workspace'
  | 'sync_agreement_records'
  | 'update_agreement_record'
  | 'view_renewal_workspace'
  | 'generate_renewal_records'
  | 'update_renewal_record'
  | 'view_ops_intelligence'
  | 'view_housing_integration_status'
  | 'view_housing_integration_logs'
  | 'sync_housing_connector'
  | 'test_housing_connector'
  | 'view_broker_inventory_workspace'
  | 'view_broker_inventory_detail'
  | 'broker_import_completed'
  | 'broker_import_duplicate_skipped'
  | 'broker_freshness_recalculated'
  | 'broker_review_resolved'
  | 'broker_project_alias_mutated'
  | 'view_broker_analytics'
  | 'view_broker_review_queue'
  | 'view_broker_directory';

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
