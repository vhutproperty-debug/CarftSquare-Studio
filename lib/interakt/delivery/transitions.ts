import { v4 as uuidv4 } from 'uuid';
import type { Db } from 'mongodb';
import type {
  DeliveryEventSource,
  DeliveryState,
  DeliveryTransition,
} from '@/lib/interakt/delivery/types';

export const INTERAKT_DELIVERY_TRANSITIONS_COLLECTION = 'interakt_delivery_transitions';

let indexesEnsured = false;

export async function ensureTransitionIndexes(db: Db): Promise<void> {
  if (indexesEnsured) return;
  const col = db.collection(INTERAKT_DELIVERY_TRANSITIONS_COLLECTION);
  await col.createIndex({ id: 1 }, { unique: true });
  await col.createIndex({ recipientId: 1, timestamp: -1 });
  await col.createIndex({ campaignId: 1, timestamp: -1 });
  await col.createIndex({ providerEventId: 1 }, { sparse: true });
  indexesEnsured = true;
}

export async function recordDeliveryTransition(
  db: Db,
  input: {
    campaignId: string;
    recipientId: string;
    attemptId?: string;
    previousState: DeliveryState | null;
    newState: DeliveryState;
    eventSource: DeliveryEventSource;
    providerMessageId?: string | null;
    providerEventId?: string | null;
    reason?: string | null;
    retryAttempt?: number | null;
    metadata?: Record<string, unknown>;
  },
): Promise<DeliveryTransition> {
  await ensureTransitionIndexes(db);
  const transition: DeliveryTransition = {
    id: uuidv4(),
    campaignId: input.campaignId,
    recipientId: input.recipientId,
    attemptId: input.attemptId,
    previousState: input.previousState,
    newState: input.newState,
    timestamp: new Date().toISOString(),
    eventSource: input.eventSource,
    providerMessageId: input.providerMessageId,
    providerEventId: input.providerEventId,
    reason: input.reason,
    retryAttempt: input.retryAttempt,
    metadata: input.metadata,
  };
  await db.collection(INTERAKT_DELIVERY_TRANSITIONS_COLLECTION).insertOne(transition);
  return transition;
}

export async function listTransitionsForRecipient(
  db: Db,
  recipientId: string,
  limit = 50,
): Promise<DeliveryTransition[]> {
  await ensureTransitionIndexes(db);
  return (await db
    .collection(INTERAKT_DELIVERY_TRANSITIONS_COLLECTION)
    .find({ recipientId }, { projection: { _id: 0 } })
    .sort({ timestamp: -1 })
    .limit(limit)
    .toArray()) as unknown as DeliveryTransition[];
}
