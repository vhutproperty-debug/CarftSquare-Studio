import { v4 as uuidv4 } from 'uuid';
import type { Db, Filter } from 'mongodb';
import { getDb } from '@/lib/mongodb';
import {
  DEFAULT_TRUST_COUNTERS,
  PARTNER_COLLECTIONS,
} from '@/lib/partner-network/constants';
import {
  calculateProfileCompletion,
  deriveRegistrationStatus,
} from '@/lib/partner-network/profile-completion';
import type {
  ActivityLog,
  CommissionRecord,
  PartnerLead,
  PartnerRecord,
  PaymentRecord,
  RelationshipManager,
  TrustCounters,
} from '@/lib/partner-network/types';
import { notifyLeadStatusChange } from '@/lib/partner-network/notifications';
import { OTP_MAX_SENDS_PER_WINDOW, OTP_SEND_WINDOW_MS } from '@/lib/partner-network/otp';

export async function getPartnerDatabase(): Promise<Db> {
  return getDb();
}

function now() {
  return new Date().toISOString();
}

function normalizeMobile(mobile: string) {
  return String(mobile).replace(/\D/g, '').slice(-10);
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export async function ensurePartnerNetworkIndexes(db: Db) {
  await db.collection(PARTNER_COLLECTIONS.PARTNERS).createIndex({ id: 1 }, { unique: true });
  await db.collection(PARTNER_COLLECTIONS.PARTNERS).createIndex({ partnerId: 1 }, { unique: true });
  await db.collection(PARTNER_COLLECTIONS.PARTNERS).createIndex({ mobile: 1 }, { unique: true });
  await db.collection(PARTNER_COLLECTIONS.PARTNERS).createIndex({ email: 1 });
  await db.collection(PARTNER_COLLECTIONS.PARTNERS).createIndex({ status: 1, createdAt: -1 });
  await db.collection(PARTNER_COLLECTIONS.PARTNERS).createIndex({ registrationStatus: 1, createdAt: -1 });
  await db.collection(PARTNER_COLLECTIONS.PARTNERS).createIndex({ status: 1, registrationStatus: 1 });
  await db.collection(PARTNER_COLLECTIONS.LEADS).createIndex({ id: 1 }, { unique: true });
  await db.collection(PARTNER_COLLECTIONS.LEADS).createIndex({ leadId: 1 }, { unique: true });
  await db.collection(PARTNER_COLLECTIONS.LEADS).createIndex({ mobile: 1 });
  await db.collection(PARTNER_COLLECTIONS.LEADS).createIndex({ partnerId: 1, createdAt: -1 });
  await db.collection(PARTNER_COLLECTIONS.LEADS).createIndex({ status: 1, createdAt: -1 });
  await db.collection(PARTNER_COLLECTIONS.COMMISSIONS).createIndex({ id: 1 }, { unique: true });
  await db.collection(PARTNER_COLLECTIONS.COMMISSIONS).createIndex({ partnerId: 1, createdAt: -1 });
  await db.collection(PARTNER_COLLECTIONS.PAYMENTS).createIndex({ id: 1 }, { unique: true });
  await db.collection(PARTNER_COLLECTIONS.ACTIVITY).createIndex({ id: 1 }, { unique: true });
  await db.collection(PARTNER_COLLECTIONS.ACTIVITY).createIndex({ createdAt: -1 });
  await db.collection(PARTNER_COLLECTIONS.ACTIVITY).createIndex({ 'details.partnerId': 1, createdAt: -1 });
  await db.collection(PARTNER_COLLECTIONS.ACTIVITY).createIndex({ entityType: 1, entityId: 1, createdAt: -1 });
  await db.collection(PARTNER_COLLECTIONS.SETTINGS).createIndex({ key: 1 }, { unique: true });
  await db.collection(PARTNER_COLLECTIONS.OTP).createIndex({ mobile: 1 }, { unique: true });
  await db.collection(PARTNER_COLLECTIONS.OTP).createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  await db.collection(PARTNER_COLLECTIONS.MANAGERS).createIndex({ id: 1 }, { unique: true });
}

async function incrementSettingCounter(db: Db, key: string): Promise<number> {
  await db.collection(PARTNER_COLLECTIONS.SETTINGS).updateOne(
    { key },
    { $inc: { value: 1 }, $setOnInsert: { key } },
    { upsert: true },
  );
  const doc = await db.collection(PARTNER_COLLECTIONS.SETTINGS).findOne({ key });
  return Number(doc?.value ?? 1);
}

async function nextPartnerId(db: Db): Promise<string> {
  const num = await incrementSettingCounter(db, 'partner_id_counter');
  return `CSP${String(num).padStart(6, '0')}`;
}

async function nextLeadId(db: Db): Promise<string> {
  const num = await incrementSettingCounter(db, 'lead_id_counter');
  return `PNL${String(num).padStart(6, '0')}`;
}

export async function logPartnerActivity(
  db: Db,
  entry: Omit<ActivityLog, 'id' | 'createdAt'>,
) {
  await db.collection(PARTNER_COLLECTIONS.ACTIVITY).insertOne({
    id: uuidv4(),
    createdAt: now(),
    ...entry,
  });
}

export async function getTrustCounters(db: Db): Promise<TrustCounters> {
  const doc = await db.collection(PARTNER_COLLECTIONS.SETTINGS).findOne({ key: 'trust_counters' });
  return { ...DEFAULT_TRUST_COUNTERS, ...(doc?.value || {}) };
}

export async function updateTrustCounters(db: Db, counters: TrustCounters) {
  await db.collection(PARTNER_COLLECTIONS.SETTINGS).updateOne(
    { key: 'trust_counters' },
    { $set: { key: 'trust_counters', value: counters, updatedAt: now() } },
    { upsert: true },
  );
}

function emptyPartnerFields() {
  return {
    email: '',
    companyName: '',
    operatingAreas: '',
    projectsCovered: '',
    dealType: 'both',
    dealsPerMonth: '',
    whatsapp: '',
    reraNumber: undefined as string | undefined,
    city: '',
    state: '',
    agreementAccepted: false,
    leadSource: 'organic',
  };
}

function enrichPartner(partner: PartnerRecord): PartnerRecord {
  const profileCompletionPercent = calculateProfileCompletion(partner);
  const registrationStatus = deriveRegistrationStatus(partner);
  return {
    ...partner,
    profileCompletionPercent,
    registrationStatus,
    lastActivityAt: partner.lastActivityAt || partner.updatedAt || partner.createdAt,
    leadSource: partner.leadSource || 'organic',
  };
}

export async function createPartnerQuick(
  db: Db,
  input: { fullName: string; mobile: string; email: string; companyName?: string; leadSource?: string },
) {
  const mobile = normalizeMobile(input.mobile);
  const email = String(input.email || '').trim().toLowerCase();
  const companyName = String(input.companyName ?? '').trim();
  const fullName = input.fullName.trim();
  const existing = await db.collection(PARTNER_COLLECTIONS.PARTNERS).findOne({ mobile }) as PartnerRecord | null;

  if (existing) {
    if (existing.registrationStatus === 'incomplete' || calculateProfileCompletion(existing) < 100) {
      const patch: Partial<PartnerRecord> = { updatedAt: now() };
      if (email && email !== existing.email) patch.email = email;
      if (fullName && fullName !== existing.fullName) patch.fullName = fullName;
      if (companyName !== (existing.companyName || '')) patch.companyName = companyName;

      if (Object.keys(patch).length > 1) {
        await db.collection(PARTNER_COLLECTIONS.PARTNERS).updateOne(
          { id: existing.id },
          { $set: patch },
        );
        const resumed = enrichPartner({ ...existing, ...patch });
        if (process.env.NODE_ENV === 'development') {
          console.log('[partner-network] createPartnerQuick resumed', {
            partnerId: resumed.partnerId,
            email: resumed.email,
            mobile: resumed.mobile,
            status: resumed.status,
          });
        }
        return resumed;
      }

      if (process.env.NODE_ENV === 'development') {
        console.log('[partner-network] createPartnerQuick resumed existing', {
          partnerId: existing.partnerId,
          email: existing.email,
          mobile: existing.mobile,
        });
      }
      return enrichPartner(existing);
    }
    throw new Error('A partner with this mobile number already exists.');
  }

  if (process.env.NODE_ENV === 'development') {
    console.log('[partner-network] createPartnerQuick payload', {
      fullName,
      mobile,
      email,
      companyName: companyName || '',
      leadSource: (input.leadSource || 'organic').trim() || 'organic',
    });
  }

  const partnerId = await nextPartnerId(db);
  const ts = now();
  const base = emptyPartnerFields();
  const record: PartnerRecord = enrichPartner({
    id: uuidv4(),
    partnerId,
    fullName,
    mobile,
    ...base,
    email,
    companyName,
    leadSource: (input.leadSource || 'organic').trim() || 'organic',
    status: 'pending',
    registrationStatus: 'incomplete',
    profileCompletionPercent: 25,
    createdAt: ts,
    updatedAt: ts,
    lastActivityAt: ts,
  });

  await db.collection(PARTNER_COLLECTIONS.PARTNERS).insertOne(record);
  await logPartnerActivity(db, {
    actorType: 'system',
    actorId: 'quick_registration',
    action: 'partner_quick_registered',
    entityType: 'partner',
    entityId: record.id,
    details: { partnerId, leadSource: record.leadSource, status: 'pending' },
  });

  if (process.env.NODE_ENV === 'development') {
    console.log('[partner-network] createPartnerQuick created', {
      partnerId: record.partnerId,
      email: record.email,
      mobile: record.mobile,
      status: record.status,
    });
  }

  return record;
}

export async function updatePartnerProfile(
  db: Db,
  partnerId: string,
  mobile: string | undefined,
  updates: Partial<PartnerRecord>,
) {
  const partner = await getPartnerByPartnerId(db, partnerId);
  if (!partner) throw new Error('Partner not found.');
  if (mobile && normalizeMobile(partner.mobile) !== normalizeMobile(mobile)) {
    throw new Error('Mobile number does not match partner record.');
  }

  const patch: Partial<PartnerRecord> = {
    operatingAreas: updates.operatingAreas,
    projectsCovered: updates.projectsCovered,
    dealType: updates.dealType,
    dealsPerMonth: updates.dealsPerMonth,
    city: updates.city,
    state: updates.state,
    whatsapp: updates.whatsapp,
    reraNumber: updates.reraNumber,
    email: updates.email,
    agreementAccepted: updates.agreementAccepted,
    updatedAt: now(),
    lastActivityAt: now(),
  };
  if (updates.whatsapp) patch.whatsapp = normalizeMobile(updates.whatsapp);
  if (updates.reraNumber === '') patch.reraNumber = undefined;
  if (updates.companyName !== undefined) patch.companyName = String(updates.companyName).trim();

  Object.keys(patch).forEach((key) => {
    if (patch[key] === undefined) delete patch[key];
  });

  if (process.env.NODE_ENV === 'development') {
    console.log('[partner-network] updatePartnerProfile patch', { partnerId, mobile: normalizeMobile(mobile), patch });
  }

  const merged = { ...partner, ...patch };
  patch.profileCompletionPercent = calculateProfileCompletion(merged);
  patch.registrationStatus = deriveRegistrationStatus(merged);

  await db.collection(PARTNER_COLLECTIONS.PARTNERS).updateOne({ id: partner.id }, { $set: patch });
  await logPartnerActivity(db, {
    actorType: 'partner',
    actorId: partner.id,
    action: 'partner_profile_updated',
    entityType: 'partner',
    entityId: partner.id,
    details: { profileCompletionPercent: patch.profileCompletionPercent },
  });

  const updated = await getPartnerById(db, partner.id);
  return updated ? enrichPartner(updated) : null;
}

export async function createPartner(db: Db, input: Omit<PartnerRecord, 'id' | 'partnerId' | 'status' | 'createdAt' | 'updatedAt' | 'registrationStatus' | 'profileCompletionPercent' | 'leadSource' | 'lastActivityAt'>) {
  const mobile = normalizeMobile(input.mobile);
  const existing = await db.collection(PARTNER_COLLECTIONS.PARTNERS).findOne({ mobile });
  if (existing) throw new Error('A partner with this mobile number already exists.');

  const partnerId = await nextPartnerId(db);
  const ts = now();
  const record: PartnerRecord = enrichPartner({
    id: uuidv4(),
    partnerId,
    ...input,
    mobile,
    whatsapp: normalizeMobile(input.whatsapp || input.mobile),
    leadSource: (input as PartnerRecord).leadSource || 'organic',
    status: 'pending',
    createdAt: ts,
    updatedAt: ts,
    lastActivityAt: ts,
  });

  await db.collection(PARTNER_COLLECTIONS.PARTNERS).insertOne(record);
  await logPartnerActivity(db, {
    actorType: 'system',
    actorId: 'registration',
    action: 'partner_registered',
    entityType: 'partner',
    entityId: record.id,
    details: { partnerId },
  });

  return record;
}

export async function getPartnerByMobile(db: Db, mobile: string) {
  const normalized = normalizeMobile(mobile);
  if (!normalized || normalized.length < 10) return null;

  let doc = await db.collection(PARTNER_COLLECTIONS.PARTNERS).findOne(
    { mobile: normalized },
    { projection: { _id: 0 } },
  ) as PartnerRecord | null;

  if (!doc) {
    const candidates = await db.collection(PARTNER_COLLECTIONS.PARTNERS)
      .find({ mobile: { $regex: `${escapeRegex(normalized)}$` } }, { projection: { _id: 0 } })
      .limit(10)
      .toArray() as PartnerRecord[];
    doc = candidates.find((p) => normalizeMobile(p.mobile) === normalized) || null;

    if (doc && doc.mobile !== normalized) {
      await db.collection(PARTNER_COLLECTIONS.PARTNERS).updateOne(
        { id: doc.id },
        { $set: { mobile: normalized, updatedAt: now() } },
      );
      doc.mobile = normalized;
    }
  }

  return doc ? enrichPartner(doc) : null;
}

export async function getPartnerByEmail(db: Db, email: string) {
  const normalized = String(email || '').trim().toLowerCase();
  if (!normalized || !normalized.includes('@')) return null;

  const doc = await db.collection(PARTNER_COLLECTIONS.PARTNERS).findOne(
    { email: normalized },
    { projection: { _id: 0 } },
  ) as PartnerRecord | null;

  return doc ? enrichPartner(doc) : null;
}

export async function resolvePartnerByIdentifier(db: Db, identifier: string) {
  const raw = String(identifier || '').trim();
  if (!raw) return null;
  if (raw.includes('@')) return getPartnerByEmail(db, raw);
  return getPartnerByMobile(db, raw);
}

export async function getPartnerById(db: Db, id: string) {
  const doc = await db.collection(PARTNER_COLLECTIONS.PARTNERS).findOne(
    { id },
    { projection: { _id: 0 } },
  ) as PartnerRecord | null;
  return doc ? enrichPartner(doc) : null;
}

export async function getPartnerByPartnerId(db: Db, partnerId: string) {
  return db.collection(PARTNER_COLLECTIONS.PARTNERS).findOne(
    { partnerId },
    { projection: { _id: 0 } },
  ) as Promise<PartnerRecord | null>;
}

export async function listPartners(
  db: Db,
  options: { status?: string; q?: string; page?: number; limit?: number } = {},
) {
  const page = Math.max(1, Number(options.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(options.limit) || 20));
  const query: Filter<PartnerRecord> = {};
  if (options.status && options.status !== 'all') query.status = options.status as PartnerRecord['status'];
  if (options.q?.trim()) {
    const q = escapeRegex(options.q.trim());
    query.$or = [
      { fullName: { $regex: q, $options: 'i' } },
      { partnerId: { $regex: q, $options: 'i' } },
      { mobile: { $regex: q, $options: 'i' } },
      { email: { $regex: q, $options: 'i' } },
      { companyName: { $regex: q, $options: 'i' } },
    ];
  }

  const [total, partners] = await Promise.all([
    db.collection(PARTNER_COLLECTIONS.PARTNERS).countDocuments(query),
    db.collection(PARTNER_COLLECTIONS.PARTNERS)
      .find(query, { projection: { _id: 0 } })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .toArray(),
  ]);

  return { partners: (partners as PartnerRecord[]).map(enrichPartner), total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) };
}

export async function updatePartner(
  db: Db,
  id: string,
  updates: Partial<PartnerRecord>,
  actorId: string,
) {
  const existing = await getPartnerById(db, id);
  if (!existing) throw new Error('Partner not found.');

  const patch: Partial<PartnerRecord> = { ...updates, updatedAt: now() };
  if (updates.status === 'approved') patch.approvedAt = now();
  if (updates.status && updates.status !== 'approved') {
    patch.approvedAt = undefined;
  }

  const $set: Record<string, unknown> = { ...patch };
  const $unset: Record<string, ''> = {};
  if (updates.status && updates.status !== 'approved') {
    delete $set.approvedAt;
    $unset.approvedAt = '';
  }

  const result = await db.collection(PARTNER_COLLECTIONS.PARTNERS).updateOne(
    { id },
    { $set, ...Object.keys($unset).length ? { $unset } : {} },
  );
  if (result.matchedCount === 0) throw new Error('Partner not found.');

  if (updates.status) {
    const persisted = await getPartnerById(db, id);
    if (!persisted || persisted.status !== updates.status) {
      throw new Error('Partner status update did not persist.');
    }
    if (process.env.NODE_ENV === 'development') {
      console.log('[partner-network] admin approval update', {
        partnerId: persisted.partnerId,
        status: persisted.status,
        actorId,
      });
    }
  }

  const action = updates.status === 'approved'
    ? 'partner_approved'
    : updates.status === 'rejected'
      ? 'partner_rejected'
      : updates.status === 'suspended'
        ? 'partner_suspended'
        : 'partner_updated';

  await logPartnerActivity(db, {
    actorType: 'admin',
    actorId,
    action,
    entityType: 'partner',
    entityId: id,
    details: {
      partnerId: existing.partnerId,
      previousStatus: existing.status,
      ...updates,
    } as Record<string, unknown>,
  });

  const updated = await getPartnerById(db, id);
  return updated ? enrichPartner(updated) : null;
}

export async function createPartnerLead(
  db: Db,
  partner: PartnerRecord,
  input: Omit<PartnerLead, 'id' | 'leadId' | 'partnerId' | 'partnerRecordId' | 'status' | 'createdAt' | 'updatedAt'>,
) {
  const mobile = normalizeMobile(input.mobile);
  const duplicate = await db.collection(PARTNER_COLLECTIONS.LEADS).findOne({
    mobile,
    status: { $nin: ['completed', 'reward_released'] },
  });
  if (duplicate) throw new Error('A lead with this mobile number already exists in the pipeline.');

  const leadId = await nextLeadId(db);
  const record: PartnerLead = {
    id: uuidv4(),
    leadId,
    partnerId: partner.partnerId,
    partnerRecordId: partner.id,
    ...input,
    mobile,
    status: 'registered',
    createdAt: now(),
    updatedAt: now(),
  };

  await db.collection(PARTNER_COLLECTIONS.LEADS).insertOne(record);
  await logPartnerActivity(db, {
    actorType: 'partner',
    actorId: partner.id,
    action: 'lead_submitted',
    entityType: 'lead',
    entityId: record.id,
    details: { leadId },
  });

  return record;
}

export async function listPartnerLeads(
  db: Db,
  options: { partnerId?: string; status?: string; q?: string; page?: number; limit?: number } = {},
) {
  const page = Math.max(1, Number(options.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(options.limit) || 20));
  const query: Filter<PartnerLead> = {};
  if (options.partnerId) query.partnerId = options.partnerId;
  if (options.status && options.status !== 'all') query.status = options.status as PartnerLead['status'];
  if (options.q?.trim()) {
    const q = escapeRegex(options.q.trim());
    query.$or = [
      { clientName: { $regex: q, $options: 'i' } },
      { leadId: { $regex: q, $options: 'i' } },
      { mobile: { $regex: q, $options: 'i' } },
      { location: { $regex: q, $options: 'i' } },
    ];
  }

  const [total, leads] = await Promise.all([
    db.collection(PARTNER_COLLECTIONS.LEADS).countDocuments(query),
    db.collection(PARTNER_COLLECTIONS.LEADS)
      .find(query, { projection: { _id: 0 } })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .toArray(),
  ]);

  return { leads: leads as PartnerLead[], total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) };
}

export async function updatePartnerLead(
  db: Db,
  id: string,
  updates: Partial<PartnerLead>,
  actorType: 'admin' | 'partner',
  actorId: string,
) {
  const existing = await db.collection(PARTNER_COLLECTIONS.LEADS).findOne(
    { id },
    { projection: { _id: 0 } },
  ) as PartnerLead | null;
  if (!existing) throw new Error('Lead not found.');

  const patch: Partial<PartnerLead> = { ...updates, updatedAt: now() };

  if (updates.commissionStatus === 'paid') {
    const amount = updates.commissionAmount ?? existing.commissionAmount;
    if (!amount || Number(amount) <= 0) {
      throw new Error('Commission amount is required before marking as paid.');
    }
    if (!updates.paymentDate && !existing.paymentDate) {
      patch.paymentDate = now();
    }
  }

  if (updates.paymentDate === '') {
    delete patch.paymentDate;
  }
  if (updates.paymentRemarks === '') {
    patch.paymentRemarks = '';
  }

  const result = await db.collection(PARTNER_COLLECTIONS.LEADS).updateOne({ id }, { $set: patch });
  if (result.matchedCount === 0) throw new Error('Lead not found.');

  const statusChanged = Boolean(updates.status && updates.status !== existing.status);
  const action = statusChanged
    ? 'lead_status_changed'
    : updates.commissionStatus === 'paid'
      ? 'commission_paid'
      : updates.commissionAmount !== undefined
        || updates.commissionStatus !== undefined
        || updates.commissionType !== undefined
        || updates.paymentRemarks !== undefined
        || updates.paymentDate !== undefined
        ? 'commission_updated'
        : 'lead_updated';

  await logPartnerActivity(db, {
    actorType,
    actorId,
    action,
    entityType: 'lead',
    entityId: id,
    details: {
      leadId: existing.leadId,
      partnerId: existing.partnerId,
      previousStatus: existing.status,
      ...(statusChanged ? { status: updates.status } : {}),
      ...(!statusChanged ? updates : {}),
    } as Record<string, unknown>,
  });

  if (statusChanged) {
    const partner = await getPartnerByPartnerId(db, existing.partnerId);
    if (partner) {
      notifyLeadStatusChange(
        { leadId: existing.leadId, status: updates.status, clientName: existing.clientName },
        { mobile: partner.mobile, email: partner.email, fullName: partner.fullName },
      ).catch((error) => {
        console.error('[partner-network] notifyLeadStatusChange failed', error instanceof Error ? error.message : error);
      });
    }
  }

  return db.collection(PARTNER_COLLECTIONS.LEADS).findOne({ id }, { projection: { _id: 0 } }) as Promise<PartnerLead | null>;
}

export async function getPartnerDashboardStats(db: Db, partnerId: string) {
  const leads = await db.collection(PARTNER_COLLECTIONS.LEADS)
    .find({ partnerId }, { projection: { _id: 0, status: 1, commissionAmount: 1, commissionStatus: 1 } })
    .toArray() as PartnerLead[];

  const commissionPending = leads
    .filter((l) => l.commissionStatus === 'pending' || l.commissionStatus === 'approved')
    .reduce((sum, l) => sum + (Number(l.commissionAmount) || 0), 0);
  const commissionPaid = leads
    .filter((l) => l.commissionStatus === 'paid')
    .reduce((sum, l) => sum + (Number(l.commissionAmount) || 0), 0);

  return {
    totalLeads: leads.length,
    qualifiedLeads: leads.filter((l) => !['registered'].includes(l.status)).length,
    projectsWon: leads.filter((l) => ['won', 'execution', 'completed', 'reward_released'].includes(l.status)).length,
    projectsCompleted: leads.filter((l) => ['completed', 'reward_released'].includes(l.status)).length,
    commissionPending,
    commissionPaid,
    leadsByStatus: leads.reduce((acc, l) => {
      acc[l.status] = (acc[l.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
  };
}

const WON_LEAD_STATUSES = ['won', 'execution', 'completed', 'reward_released'] as const;

function countFromFacet(rows: { count?: number }[] | undefined) {
  return rows?.[0]?.count ?? 0;
}

function sumFromFacet(rows: { total?: number }[] | undefined) {
  return rows?.[0]?.total ?? 0;
}

/** Recompute and persist registrationStatus + profileCompletionPercent for all partners. */
export async function backfillPartnerRegistrationFields(db: Db) {
  const partners = await db.collection(PARTNER_COLLECTIONS.PARTNERS)
    .find({}, { projection: { _id: 0 } })
    .toArray() as PartnerRecord[];

  let updated = 0;
  for (const partner of partners) {
    const enriched = enrichPartner(partner);
    const needsUpdate = partner.registrationStatus !== enriched.registrationStatus
      || partner.profileCompletionPercent !== enriched.profileCompletionPercent;

    if (needsUpdate) {
      await db.collection(PARTNER_COLLECTIONS.PARTNERS).updateOne(
        { id: partner.id },
        {
          $set: {
            registrationStatus: enriched.registrationStatus,
            profileCompletionPercent: enriched.profileCompletionPercent,
            updatedAt: now(),
          },
        },
      );
      updated += 1;
    }
  }

  return { scanned: partners.length, updated };
}

export async function getAdminDashboardStats(db: Db) {
  const [partnerAgg, leadAgg] = await Promise.all([
    db.collection(PARTNER_COLLECTIONS.PARTNERS).aggregate([
      {
        $facet: {
          total: [{ $count: 'count' }],
          approved: [{ $match: { status: 'approved' } }, { $count: 'count' }],
          pending: [{ $match: { status: 'pending' } }, { $count: 'count' }],
          rejected: [{ $match: { status: 'rejected' } }, { $count: 'count' }],
          suspended: [{ $match: { status: 'suspended' } }, { $count: 'count' }],
          incomplete: [
            {
              $match: {
                $or: [
                  { registrationStatus: 'incomplete' },
                  { registrationStatus: { $exists: false } },
                ],
              },
            },
            { $count: 'count' },
          ],
          pendingComplete: [
            { $match: { status: 'pending', registrationStatus: 'complete' } },
            { $count: 'count' },
          ],
        },
      },
    ]).toArray(),
    db.collection(PARTNER_COLLECTIONS.LEADS).aggregate([
      {
        $facet: {
          total: [{ $count: 'count' }],
          won: [{ $match: { status: { $in: [...WON_LEAD_STATUSES] } } }, { $count: 'count' }],
          qualified: [{ $match: { status: { $ne: 'registered' } } }, { $count: 'count' }],
          completed: [{ $match: { status: { $in: ['completed', 'reward_released'] } } }, { $count: 'count' }],
          commissionPending: [
            {
              $match: { commissionStatus: { $in: ['pending', 'approved'] } },
            },
            { $group: { _id: null, total: { $sum: { $ifNull: ['$commissionAmount', 0] } } } },
          ],
          commissionPaid: [
            { $match: { commissionStatus: 'paid' } },
            { $group: { _id: null, total: { $sum: { $ifNull: ['$commissionAmount', 0] } } } },
          ],
          byStatus: [{ $group: { _id: '$status', count: { $sum: 1 } } }],
          monthly: [
            {
              $group: {
                _id: { $substr: ['$createdAt', 0, 7] },
                count: { $sum: 1 },
              },
            },
            { $sort: { _id: 1 } },
          ],
        },
      },
    ]).toArray(),
  ]);

  const p = (partnerAgg[0] || {}) as Record<string, { count?: number }[]>;
  const l = (leadAgg[0] || {}) as Record<string, unknown>;

  const totalLeads = countFromFacet((l.total as { count?: number }[]) || []);
  const wonLeads = countFromFacet((l.won as { count?: number }[]) || []);
  const commissionPending = sumFromFacet((l.commissionPending as { total?: number }[]) || []);
  const commissionPaid = sumFromFacet((l.commissionPaid as { total?: number }[]) || []);

  const leadsByStatus = ((l.byStatus as { _id: string; count: number }[]) || []).reduce(
    (acc, row) => {
      if (row._id) acc[row._id] = row.count;
      return acc;
    },
    {} as Record<string, number>,
  );

  const monthlyTrends = ((l.monthly as { _id: string; count: number }[]) || [])
    .filter((row) => row._id && row._id !== 'unknown')
    .map((row) => ({ month: row._id, count: row.count }));

  return {
    totalPartners: countFromFacet(p.total),
    approvedPartners: countFromFacet(p.approved),
    pendingPartners: countFromFacet(p.pending),
    rejectedPartners: countFromFacet(p.rejected),
    suspendedPartners: countFromFacet(p.suspended),
    incompleteRegistrations: countFromFacet(p.incomplete),
    pendingApproval: countFromFacet(p.pendingComplete),
    totalLeads,
    wonLeads,
    qualifiedLeads: countFromFacet((l.qualified as { count?: number }[]) || []),
    projectsWon: wonLeads,
    projectsCompleted: countFromFacet((l.completed as { count?: number }[]) || []),
    conversionRatio: totalLeads ? Math.round((wonLeads / totalLeads) * 100) : 0,
    commissionPending,
    commissionPaid,
    commissionReleased: commissionPaid,
    leadsByStatus,
    monthlyTrends,
  };
}

export async function saveOtpSession(db: Db, mobile: string, otpHash: string, expiresAt: string) {
  const key = normalizeMobile(mobile);
  const existing = await db.collection(PARTNER_COLLECTIONS.OTP).findOne({ mobile: key });
  const nowTs = now();
  const windowStart = existing?.sendWindowStart;
  const windowExpired = !windowStart || Date.now() - new Date(windowStart).getTime() > OTP_SEND_WINDOW_MS;
  const sendCount = windowExpired ? 1 : Number(existing?.sendCount || 0) + 1;

  if (!windowExpired && sendCount > OTP_MAX_SENDS_PER_WINDOW) {
    throw new Error('Too many OTP requests. Please wait before trying again.');
  }

  await db.collection(PARTNER_COLLECTIONS.OTP).updateOne(
    { mobile: key },
    {
      $set: {
        mobile: key,
        otpHash,
        expiresAt,
        attempts: 0,
        sendCount,
        sendWindowStart: windowExpired ? nowTs : (windowStart || nowTs),
        lastSentAt: nowTs,
      },
    },
    { upsert: true },
  );
}

export async function deleteOtpSession(db: Db, mobile: string) {
  await db.collection(PARTNER_COLLECTIONS.OTP).deleteOne({ mobile: normalizeMobile(mobile) });
}

export async function incrementOtpAttempts(db: Db, mobile: string) {
  await db.collection(PARTNER_COLLECTIONS.OTP).updateOne(
    { mobile: normalizeMobile(mobile) },
    { $inc: { attempts: 1 } },
  );
}

export async function getOtpSession(db: Db, mobile: string) {
  return db.collection(PARTNER_COLLECTIONS.OTP).findOne({ mobile: normalizeMobile(mobile) });
}

export async function listActivityForPartner(
  db: Db,
  partnerId: string,
  partnerRecordId: string,
  limit = 50,
) {
  const activity = await db.collection(PARTNER_COLLECTIONS.ACTIVITY)
    .find({
      $or: [
        { 'details.partnerId': partnerId },
        { actorId: partnerRecordId, actorType: 'partner' },
      ],
    }, { projection: { _id: 0 } })
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray();

  return activity as ActivityLog[];
}

export async function listActivityLogs(
  db: Db,
  options: { page?: number; limit?: number } | number = {},
) {
  const opts = typeof options === 'number' ? { page: 1, limit: options } : options;
  const page = Math.max(1, Number(opts.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(opts.limit) || 50));

  const [total, activity] = await Promise.all([
    db.collection(PARTNER_COLLECTIONS.ACTIVITY).countDocuments({}),
    db.collection(PARTNER_COLLECTIONS.ACTIVITY)
      .find({}, { projection: { _id: 0 } })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .toArray(),
  ]);

  return {
    activity: activity as ActivityLog[],
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

export async function listManagers(db: Db) {
  return db.collection(PARTNER_COLLECTIONS.MANAGERS)
    .find({}, { projection: { _id: 0 } })
    .sort({ name: 1 })
    .toArray() as Promise<RelationshipManager[]>;
}

export async function saveManager(db: Db, input: Omit<RelationshipManager, 'id' | 'createdAt'>) {
  const record: RelationshipManager = { id: uuidv4(), createdAt: now(), ...input };
  await db.collection(PARTNER_COLLECTIONS.MANAGERS).insertOne(record);
  return record;
}

export async function recordPayment(db: Db, input: Omit<PaymentRecord, 'id' | 'createdAt'>, actorId: string) {
  const payment: PaymentRecord = { id: uuidv4(), createdAt: now(), ...input };
  await db.collection(PARTNER_COLLECTIONS.PAYMENTS).insertOne(payment);
  await logPartnerActivity(db, {
    actorType: 'admin',
    actorId,
    action: 'payment_recorded',
    entityType: 'payment',
    entityId: payment.id,
    details: input as unknown as Record<string, unknown>,
  });
  return payment;
}

export async function listPayments(db: Db, partnerId?: string) {
  const query = partnerId ? { partnerId } : {};
  return db.collection(PARTNER_COLLECTIONS.PAYMENTS)
    .find(query, { projection: { _id: 0 } })
    .sort({ createdAt: -1 })
    .toArray() as Promise<PaymentRecord[]>;
}

export async function getTopPartners(db: Db, limit = 10) {
  const pipeline = [
    { $group: { _id: '$partnerId', leads: { $sum: 1 }, won: { $sum: { $cond: [{ $in: ['$status', ['won', 'execution', 'completed', 'reward_released']] }, 1, 0] } } } },
    { $sort: { won: -1, leads: -1 } },
    { $limit: limit },
  ];
  return db.collection(PARTNER_COLLECTIONS.LEADS).aggregate(pipeline).toArray();
}

export async function exportPartnersCsv(db: Db) {
  const partners = await db.collection(PARTNER_COLLECTIONS.PARTNERS).find({}, { projection: { _id: 0 } }).toArray();
  const headers = ['partnerId', 'fullName', 'mobile', 'email', 'companyName', 'city', 'state', 'status', 'registrationStatus', 'profileCompletionPercent', 'leadSource', 'createdAt', 'lastActivityAt'];
  const rows = partners.map((p) => headers.map((h) => `"${String((p as Record<string, unknown>)[h] || '').replace(/"/g, '""')}"`).join(','));
  return [headers.join(','), ...rows].join('\n');
}

export async function exportLeadsCsv(db: Db) {
  const leads = await db.collection(PARTNER_COLLECTIONS.LEADS).find({}, { projection: { _id: 0 } }).toArray();
  const headers = ['leadId', 'partnerId', 'clientName', 'mobile', 'location', 'status', 'budget', 'commissionAmount', 'commissionType', 'commissionStatus', 'paymentRemarks', 'paymentDate', 'createdAt'];
  const rows = leads.map((l) => headers.map((h) => `"${String((l as Record<string, unknown>)[h] || '').replace(/"/g, '""')}"`).join(','));
  return [headers.join(','), ...rows].join('\n');
}
