import type { Db } from 'mongodb';
import { toWhatsAppRecipient } from '@/lib/whatsapp-cloud/phone';

export const WA_CONTACTS_COLLECTION = 'wa_contacts';

const WINDOW_MS = 24 * 60 * 60 * 1000;

export type WaContact = {
  waId: string;
  optIn: boolean;
  optInSource?: string;
  optInAt?: string;
  optOutAt?: string;
  lastInboundAt?: string;
  updatedAt: string;
};

let indexesEnsured = false;

async function ensureIndexes(db: Db) {
  if (indexesEnsured) return;
  await db.collection(WA_CONTACTS_COLLECTION).createIndex({ waId: 1 }, { unique: true });
  indexesEnsured = true;
}

export async function getContact(db: Db, rawWaId: string): Promise<WaContact | null> {
  await ensureIndexes(db);
  const waId = toWhatsAppRecipient(rawWaId);
  if (!waId) return null;
  return db.collection(WA_CONTACTS_COLLECTION).findOne(
    { waId },
    { projection: { _id: 0 } },
  ) as unknown as Promise<WaContact | null>;
}

export async function recordOptIn(db: Db, rawWaId: string, source: string): Promise<void> {
  await ensureIndexes(db);
  const waId = toWhatsAppRecipient(rawWaId);
  if (!waId) return;
  const now = new Date().toISOString();
  await db.collection(WA_CONTACTS_COLLECTION).updateOne(
    { waId },
    {
      $set: {
        waId,
        optIn: true,
        optInSource: source,
        optInAt: now,
        updatedAt: now,
      },
      $unset: { optOutAt: '' },
    },
    { upsert: true },
  );
}

export async function recordOptOut(db: Db, rawWaId: string): Promise<void> {
  await ensureIndexes(db);
  const waId = toWhatsAppRecipient(rawWaId);
  if (!waId) return;
  const now = new Date().toISOString();
  await db.collection(WA_CONTACTS_COLLECTION).updateOne(
    { waId },
    {
      $set: {
        waId,
        optIn: false,
        optOutAt: now,
        updatedAt: now,
      },
    },
    { upsert: true },
  );
}

export async function touchInbound(db: Db, rawWaId: string, at?: string): Promise<void> {
  await ensureIndexes(db);
  const waId = toWhatsAppRecipient(rawWaId);
  if (!waId) return;
  const now = at || new Date().toISOString();
  await db.collection(WA_CONTACTS_COLLECTION).updateOne(
    { waId },
    {
      $set: { waId, lastInboundAt: now, updatedAt: now },
      $setOnInsert: { optIn: true, optInSource: 'inbound_message', optInAt: now },
    },
    { upsert: true },
  );
}

export async function isOptedOut(db: Db, rawWaId: string): Promise<boolean> {
  const contact = await getContact(db, rawWaId);
  return Boolean(contact && contact.optIn === false && contact.optOutAt);
}

export async function canSendFreeform(db: Db, rawWaId: string): Promise<boolean> {
  const contact = await getContact(db, rawWaId);
  if (!contact?.lastInboundAt) return false;
  if (contact.optIn === false && contact.optOutAt) return false;
  const at = new Date(contact.lastInboundAt).getTime();
  if (Number.isNaN(at)) return false;
  return Date.now() - at < WINDOW_MS;
}

const STOP_PATTERN = /^\s*(stop|unsubscribe|stopall|cancel)\s*$/i;

export function isStopKeyword(text: string | null | undefined): boolean {
  return STOP_PATTERN.test(String(text || ''));
}
