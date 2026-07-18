import { v4 as uuidv4 } from 'uuid';
import type { Db } from 'mongodb';
import { BROKER_HISTORY_FIELDS } from '@/lib/ops/brokers/statuses';
import type { OpsBrokerInventory, OpsBrokerInventoryHistory } from '@/lib/ops/brokers/types';

export const BROKER_INVENTORY_HISTORY_COLLECTION = 'ops_broker_inventory_history';

const TRACKED = new Set<string>(BROKER_HISTORY_FIELDS);

let historyIndexesEnsured = false;

export async function ensureHistoryIndexes(db: Db): Promise<void> {
  if (historyIndexesEnsured) return;
  await db.collection(BROKER_INVENTORY_HISTORY_COLLECTION).createIndex({ id: 1 }, { unique: true });
  await db.collection(BROKER_INVENTORY_HISTORY_COLLECTION).createIndex({ inventoryId: 1, changedAt: -1 });
  await db.collection(BROKER_INVENTORY_HISTORY_COLLECTION).createIndex({ importBatchId: 1 });
  historyIndexesEnsured = true;
}

function serialize(value: unknown): string | number | null {
  if (value == null || value === '') return null;
  if (typeof value === 'number') return value;
  return String(value);
}

export function diffInventoryChanges(
  existing: OpsBrokerInventory,
  next: Partial<OpsBrokerInventory>,
  meta: { sourceMessageId?: string; importBatchId?: string; changedAt?: string },
): OpsBrokerInventoryHistory[] {
  const changedAt = meta.changedAt || new Date().toISOString();
  const events: OpsBrokerInventoryHistory[] = [];

  for (const field of TRACKED) {
    const oldValue = (existing as Record<string, unknown>)[field];
    const newValue = (next as Record<string, unknown>)[field];
    if (newValue === undefined) continue;
    const oldS = serialize(oldValue);
    const newS = serialize(newValue);
    if (oldS === newS) continue;
    if (oldS == null && newS == null) continue;
    events.push({
      id: uuidv4(),
      inventoryId: existing.id,
      fieldChanged: field,
      oldValue: oldS,
      newValue: newS,
      sourceMessageId: meta.sourceMessageId,
      importBatchId: meta.importBatchId,
      changedAt,
    });
  }

  return events;
}

export async function insertHistoryEvents(
  db: Db,
  events: OpsBrokerInventoryHistory[],
): Promise<void> {
  if (!events.length) return;
  await ensureHistoryIndexes(db);
  await db.collection(BROKER_INVENTORY_HISTORY_COLLECTION).insertMany(events, { ordered: false });
}

export async function listInventoryHistory(
  db: Db,
  inventoryId: string,
  limit = 100,
): Promise<OpsBrokerInventoryHistory[]> {
  await ensureHistoryIndexes(db);
  return db
    .collection<OpsBrokerInventoryHistory>(BROKER_INVENTORY_HISTORY_COLLECTION)
    .find({ inventoryId })
    .sort({ changedAt: -1 })
    .limit(limit)
    .toArray();
}
