import type { Db } from 'mongodb';
import { normalizeIndianMobile } from '@/lib/phone/indian-mobile';
import {
  HOUSING_RAW_COLLECTION,
  HOUSING_SOURCE,
  type HousingDedupeMatch,
  type HousingNormalizedDemand,
} from '@/lib/ops/integrations/housing/housing.types';
import { getDemandRecord } from '@/lib/ops/demand/store';
import type { OpsLeadSource } from '@/lib/ops/leads/types';

function normalizeEmail(email?: string | null): string | undefined {
  const value = email?.trim().toLowerCase();
  return value || undefined;
}

async function findRawByExternalId(db: Db, externalLeadId: string) {
  const doc = await db.collection(HOUSING_RAW_COLLECTION).findOne(
    { externalLeadId },
    { projection: { _id: 0, id: 1, externalLeadId: 1 } },
  );
  return doc as unknown as { id: string; externalLeadId: string } | null;
}

async function findRawByMobile(db: Db, mobile?: string | null) {
  const normalized = normalizeIndianMobile(mobile || undefined);
  if (!normalized) return null;
  const doc = await db.collection(HOUSING_RAW_COLLECTION).findOne(
    {
      $or: [
        { 'normalized.mobile': normalized },
        { 'normalized.mobile': mobile },
      ],
    },
    { projection: { _id: 0, id: 1, externalLeadId: 1 } },
  );
  return doc as unknown as { id: string; externalLeadId: string } | null;
}

async function findRawByEmail(db: Db, email?: string | null) {
  const normalized = normalizeEmail(email);
  if (!normalized) return null;
  const doc = await db.collection(HOUSING_RAW_COLLECTION).findOne(
    { 'normalized.email': normalized },
    { projection: { _id: 0, id: 1, externalLeadId: 1 } },
  );
  return doc as unknown as { id: string; externalLeadId: string } | null;
}

async function findRawByMobileProject(
  db: Db,
  mobile?: string | null,
  project?: string | null,
) {
  const normalized = normalizeIndianMobile(mobile || undefined);
  const projectKey = project?.trim().toLowerCase();
  if (!normalized || !projectKey) return null;
  const escaped = projectKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const doc = await db.collection(HOUSING_RAW_COLLECTION).findOne(
    {
      'normalized.mobile': { $in: [normalized, mobile].filter(Boolean) },
      'normalized.project': { $regex: new RegExp(`^${escaped}$`, 'i') },
    },
    { projection: { _id: 0, id: 1, externalLeadId: 1 } },
  );
  return doc as unknown as { id: string; externalLeadId: string } | null;
}

async function findDemandByContact(
  db: Db,
  mobile?: string | null,
  email?: string | null,
) {
  const filters = [];
  const normalizedPhone = normalizeIndianMobile(mobile || undefined);
  const normalizedEmail = normalizeEmail(email);
  if (normalizedPhone) filters.push({ normalizedPhone });
  if (normalizedEmail) filters.push({ normalizedEmail });
  if (!filters.length) return null;

  const record = await db.collection('ops_demand_records').findOne(
    { source: HOUSING_SOURCE as OpsLeadSource, $or: filters },
    { projection: { _id: 0, sourceId: 1 } },
  ) as unknown as { sourceId: string } | null;

  if (!record?.sourceId) return null;
  const doc = await db.collection(HOUSING_RAW_COLLECTION).findOne(
    { id: record.sourceId },
    { projection: { _id: 0, id: 1, externalLeadId: 1 } },
  );
  return doc as unknown as { id: string; externalLeadId: string } | null;
}

function toMatch(
  doc: { id: string; externalLeadId: string },
  reason: HousingDedupeMatch['reason'],
): HousingDedupeMatch {
  return {
    action: 'update',
    existingRawId: doc.id,
    existingSourceId: doc.id,
    reason,
  };
}

/**
 * Duplicate detection priority:
 * 1. externalLeadId
 * 2. mobile
 * 3. email
 * 4. mobile + project
 */
export async function detectHousingDuplicate(
  db: Db,
  normalized: HousingNormalizedDemand,
): Promise<HousingDedupeMatch> {
  const byExternal = await findRawByExternalId(db, normalized.externalLeadId);
  if (byExternal) return toMatch(byExternal, 'externalLeadId');

  const byMobile = await findRawByMobile(db, normalized.mobile);
  if (byMobile) return toMatch(byMobile, 'mobile');

  const byEmail = await findRawByEmail(db, normalized.email);
  if (byEmail) return toMatch(byEmail, 'email');

  const byMobileProject = await findRawByMobileProject(db, normalized.mobile, normalized.project);
  if (byMobileProject) return toMatch(byMobileProject, 'mobile_project');

  const byDemandContact = await findDemandByContact(db, normalized.mobile, normalized.email);
  if (byDemandContact) return toMatch(byDemandContact, 'mobile');

  return {
    action: 'create',
    existingRawId: normalized.rawReferenceId,
    existingSourceId: normalized.rawReferenceId,
    reason: 'externalLeadId',
  };
}

export async function getHousingDemandRecord(db: Db, sourceId: string) {
  return getDemandRecord(db, HOUSING_SOURCE as OpsLeadSource, sourceId);
}
