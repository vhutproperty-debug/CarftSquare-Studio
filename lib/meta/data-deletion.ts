import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { Db } from 'mongodb';
import { getSiteUrl } from '@/lib/site';

export const DATA_DELETION_COLLECTION = 'meta_data_deletion_requests';

export function parseSignedRequest(signedRequest: string, secret: string): { user_id?: string } | null {
  const parts = String(signedRequest || '').split('.');
  if (parts.length !== 2 || !secret) return null;
  const [encodedSig, payload] = parts;
  const sig = Buffer.from(encodedSig.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
  const expected = createHmac('sha256', secret).update(payload).digest();
  if (sig.length !== expected.length || !timingSafeEqual(sig, expected)) return null;
  try {
    const json = Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
    return JSON.parse(json) as { user_id?: string };
  } catch {
    return null;
  }
}

function confirmationCode(userId?: string) {
  const suffix = randomBytes(4).toString('hex');
  const who = String(userId || 'user').replace(/\W/g, '').slice(-8) || 'user';
  return `csdel_${who}_${suffix}`;
}

async function anonymiseMatches(db: Db, userId: string) {
  const now = new Date().toISOString();
  const leads = await db.collection('meta_ads_leads').find({}).limit(5000).toArray();
  let leadsUpdated = 0;
  for (const lead of leads) {
    const blob = JSON.stringify(lead);
    if (!userId || !blob.includes(userId)) continue;
    await db.collection('meta_ads_leads').updateOne(
      { id: (lead as { id?: string }).id },
      {
        $set: {
          name: 'deleted',
          phone: '',
          email: '',
          fieldData: {},
          status: 'deleted',
          anonymisedAt: now,
          updatedAt: now,
        },
      },
    );
    leadsUpdated += 1;
  }

  const contacts = await db.collection('wa_contacts').find({}).limit(5000).toArray();
  let contactsUpdated = 0;
  for (const contact of contacts) {
    const blob = JSON.stringify(contact);
    if (!userId || !blob.includes(userId)) continue;
    await db.collection('wa_contacts').updateOne(
      { waId: (contact as { waId?: string }).waId },
      {
        $set: {
          optIn: false,
          optOutAt: now,
          anonymisedAt: now,
          updatedAt: now,
          fbUserId: userId,
        },
      },
    );
    contactsUpdated += 1;
  }
  return { leadsUpdated, contactsUpdated };
}

export async function acceptDataDeletionRequest(db: Db, signedRequest: string, secret: string) {
  const parsed = parseSignedRequest(signedRequest, secret);
  if (!parsed) return { ok: false as const, status: 400, error: 'Invalid signed_request.' };
  const code = confirmationCode(parsed.user_id);
  const now = new Date().toISOString();
  await db.collection(DATA_DELETION_COLLECTION).insertOne({
    code,
    fbUserId: parsed.user_id || null,
    status: 'pending',
    createdAt: now,
  });
  try {
    const result = parsed.user_id
      ? await anonymiseMatches(db, String(parsed.user_id))
      : { leadsUpdated: 0, contactsUpdated: 0 };
    await db.collection(DATA_DELETION_COLLECTION).updateOne(
      { code },
      { $set: { status: 'completed', completedAt: new Date().toISOString(), result } },
    );
  } catch (error) {
    await db.collection(DATA_DELETION_COLLECTION).updateOne(
      { code },
      {
        $set: {
          status: 'failed',
          completedAt: new Date().toISOString(),
          error: error instanceof Error ? error.message : 'deletion_failed',
        },
      },
    );
  }
  const url = `${getSiteUrl().replace(/\/$/, '')}/api/data-deletion?code=${encodeURIComponent(code)}`;
  return { ok: true as const, url, confirmation_code: code };
}

export async function lookupDataDeletion(db: Db, code: string) {
  const doc = await db.collection(DATA_DELETION_COLLECTION).findOne(
    { code },
    { projection: { _id: 0 } },
  ) as { code?: string; status?: string; createdAt?: string; completedAt?: string } | null;
  if (!doc) return null;
  return {
    confirmation_code: doc.code,
    status: doc.status || 'received',
    createdAt: doc.createdAt,
    completedAt: doc.completedAt || null,
  };
}
