import type { Db } from 'mongodb';
import {
  WA_MESSAGES_COLLECTION,
  ensureWaMessageIndexes,
} from '@/lib/whatsapp-cloud/message-store';
import type { WaMessage } from '@/lib/whatsapp-cloud/types';

export async function listMessagesForConversation(
  db: Db,
  conversationId: string,
  limit = 200,
): Promise<WaMessage[]> {
  await ensureWaMessageIndexes(db);
  const rows = (await db
    .collection(WA_MESSAGES_COLLECTION)
    .find({ conversationId }, { projection: { _id: 0 } })
    .sort({ createdAt: 1 })
    .limit(limit)
    .toArray()) as unknown as WaMessage[];
  return rows;
}
