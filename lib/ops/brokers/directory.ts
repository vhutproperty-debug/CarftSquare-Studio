import { v4 as uuidv4 } from 'uuid';
import type { Db } from 'mongodb';
import { normalizePhone } from '@/lib/ops/brokers/normalize/normalize';
import type { OpsBrokerDirectory } from '@/lib/ops/brokers/types';

export const BROKER_DIRECTORY_COLLECTION = 'ops_brokers';

export async function ensureBrokerDirectoryIndexes(db: Db): Promise<void> {
  await db.collection(BROKER_DIRECTORY_COLLECTION).createIndex({ id: 1 }, { unique: true });
  await db.collection(BROKER_DIRECTORY_COLLECTION).createIndex({ phones: 1 });
  await db.collection(BROKER_DIRECTORY_COLLECTION).createIndex({ canonicalName: 1 });
  await db.collection(BROKER_DIRECTORY_COLLECTION).createIndex({ aliases: 1 });
  await db.collection(BROKER_DIRECTORY_COLLECTION).createIndex({ lastSeenAt: -1 });
}

function nameKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export async function resolveOrCreateBroker(
  db: Db,
  input: {
    senderName?: string;
    senderPhone?: string;
    groupName: string;
    seenAt: string;
  },
): Promise<OpsBrokerDirectory | null> {
  await ensureBrokerDirectoryIndexes(db);
  const phone = normalizePhone(input.senderPhone);
  const name = input.senderName?.trim();
  if (!phone && !name) return null;

  const col = db.collection<OpsBrokerDirectory>(BROKER_DIRECTORY_COLLECTION);
  let existing: OpsBrokerDirectory | null = null;

  if (phone) {
    existing = await col.findOne({ phones: phone });
  }
  if (!existing && name) {
    const key = nameKey(name);
    existing = await col.findOne({
      $or: [
        { canonicalName: { $regex: `^${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } },
        { aliases: key },
      ],
    });
  }

  const now = new Date().toISOString();

  if (existing) {
    const phones = phone && !existing.phones.includes(phone)
      ? [...existing.phones, phone]
      : existing.phones;
    const aliases = name && nameKey(name) !== nameKey(existing.canonicalName)
      && !existing.aliases.includes(nameKey(name))
      ? [...existing.aliases, nameKey(name)]
      : existing.aliases;
    const groups = existing.whatsappGroups.includes(input.groupName)
      ? existing.whatsappGroups
      : [...existing.whatsappGroups, input.groupName];

    await col.updateOne(
      { id: existing.id },
      {
        $set: {
          phones,
          aliases,
          whatsappGroups: groups,
          lastSeenAt: input.seenAt || now,
          updatedAt: now,
        },
      },
    );

    return {
      ...existing,
      phones,
      aliases,
      whatsappGroups: groups,
      lastSeenAt: input.seenAt || now,
      updatedAt: now,
    };
  }

  const record: OpsBrokerDirectory = {
    id: uuidv4(),
    canonicalName: name || (phone ? `Broker ${phone.slice(-4)}` : 'Unknown broker'),
    phones: phone ? [phone] : [],
    aliases: name ? [nameKey(name)] : [],
    whatsappGroups: [input.groupName],
    firstSeenAt: input.seenAt || now,
    lastSeenAt: input.seenAt || now,
    inventoryCount: 0,
    activeInventory: 0,
    confidenceScore: phone ? 80 : 50,
    createdAt: now,
    updatedAt: now,
  };

  await col.insertOne(record);
  return record;
}

export async function bumpBrokerInventoryStats(
  db: Db,
  brokerId: string,
  opts: { created: boolean; freshnessDays?: number },
): Promise<void> {
  await ensureBrokerDirectoryIndexes(db);
  const inc: Record<string, number> = { inventoryCount: opts.created ? 1 : 0 };
  if (opts.created) inc.activeInventory = 1;
  await db.collection(BROKER_DIRECTORY_COLLECTION).updateOne(
    { id: brokerId },
    {
      $inc: inc,
      $set: {
        updatedAt: new Date().toISOString(),
        ...(opts.freshnessDays != null ? { averageFreshnessDays: opts.freshnessDays } : {}),
      },
    },
  );
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export async function listBrokers(
  db: Db,
  opts: { page: number; pageSize: number; search?: string },
): Promise<{ items: OpsBrokerDirectory[]; total: number }> {
  await ensureBrokerDirectoryIndexes(db);
  const filter: Record<string, unknown> = {};
  if (opts.search?.trim()) {
    const q = escapeRegex(opts.search.trim());
    const phoneDigits = opts.search.replace(/\D/g, '');
    filter.$or = [
      { canonicalName: { $regex: q, $options: 'i' } },
      ...(phoneDigits ? [{ phones: { $regex: escapeRegex(phoneDigits) } }] : []),
      { agency: { $regex: q, $options: 'i' } },
    ];
  }
  const col = db.collection<OpsBrokerDirectory>(BROKER_DIRECTORY_COLLECTION);
  const total = await col.countDocuments(filter);
  const items = await col
    .find(filter)
    .sort({ lastSeenAt: -1 })
    .skip((opts.page - 1) * opts.pageSize)
    .limit(opts.pageSize)
    .toArray();
  return { items, total };
}

export async function getBroker(db: Db, id: string): Promise<OpsBrokerDirectory | null> {
  await ensureBrokerDirectoryIndexes(db);
  return db.collection<OpsBrokerDirectory>(BROKER_DIRECTORY_COLLECTION).findOne({ id });
}

export async function updateBroker(
  db: Db,
  id: string,
  patch: Partial<Pick<OpsBrokerDirectory, 'canonicalName' | 'agency' | 'notes' | 'aliases' | 'phones'>>,
): Promise<OpsBrokerDirectory | null> {
  await ensureBrokerDirectoryIndexes(db);
  await db.collection(BROKER_DIRECTORY_COLLECTION).updateOne(
    { id },
    { $set: { ...patch, updatedAt: new Date().toISOString() } },
  );
  return getBroker(db, id);
}
