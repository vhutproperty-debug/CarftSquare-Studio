import type { Db } from 'mongodb';
import {
  INTERAKT_MESSAGES_COLLECTION,
  ensureInteraktMessageIndexes,
} from '@/lib/interakt/message-store';
import type { InteraktMessage } from '@/lib/interakt/types';

export async function listMessagesForConversation(
  db: Db,
  conversationId: string,
  limit = 200,
): Promise<InteraktMessage[]> {
  await ensureInteraktMessageIndexes(db);
  const rows = (await db
    .collection(INTERAKT_MESSAGES_COLLECTION)
    .find({ conversationId }, { projection: { _id: 0 } })
    .sort({ createdAt: 1 })
    .limit(limit)
    .toArray()) as InteraktMessage[];
  return rows;
}
