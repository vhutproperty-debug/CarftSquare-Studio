import type { Db, Filter } from 'mongodb';
import {
  WA_CONVERSATIONS_COLLECTION,
  ensureWaConversationIndexes,
} from '@/lib/whatsapp-cloud/conversation-store';
import type { WaConversation, WaMatchStatus } from '@/lib/whatsapp-cloud/types';

export type ConversationListFilters = {
  matchStatus?: WaMatchStatus;
  unreadOnly?: boolean;
  search?: string;
  limit?: number;
  businessWaNumber?: string;
};

export async function listWaConversations(
  db: Db,
  filters: ConversationListFilters = {},
): Promise<WaConversation[]> {
  await ensureWaConversationIndexes(db);
  const businessWaNumber = filters.businessWaNumber;
  const query: Filter<WaConversation> = { hidden: { $ne: true } };

  if (businessWaNumber) {
    query.businessWaNumber = businessWaNumber;
  }
  if (filters.matchStatus) {
    query.matchStatus = filters.matchStatus;
  }
  if (filters.unreadOnly) {
    query.unreadCount = { $gt: 0 };
  }

  const search = filters.search?.trim();
  if (search) {
    const digits = search.replace(/\D/g, '');
    query.$or = [
      { normalizedPhone: { $regex: digits || search, $options: 'i' } },
      { customerWaE164: { $regex: digits || search, $options: 'i' } },
      { 'primaryLink.label': { $regex: search, $options: 'i' } },
    ];
  }

  return db
    .collection(WA_CONVERSATIONS_COLLECTION)
    .find(query, { projection: { _id: 0 } })
    .sort({ lastMessageAt: -1, updatedAt: -1 })
    .limit(filters.limit || 200)
    .toArray() as unknown as Promise<WaConversation[]>;
}

export async function getWaConversationMetrics(db: Db, businessWaNumber?: string) {
  await ensureWaConversationIndexes(db);
  const match: Filter<WaConversation> = { hidden: { $ne: true } };
  if (businessWaNumber) match.businessWaNumber = businessWaNumber;

  const [total, unread, unmatched, ambiguous, matched] = await Promise.all([
    db.collection(WA_CONVERSATIONS_COLLECTION).countDocuments(match),
    db.collection(WA_CONVERSATIONS_COLLECTION).countDocuments({ ...match, unreadCount: { $gt: 0 } }),
    db.collection(WA_CONVERSATIONS_COLLECTION).countDocuments({ ...match, matchStatus: 'unmatched' }),
    db.collection(WA_CONVERSATIONS_COLLECTION).countDocuments({ ...match, matchStatus: 'ambiguous' }),
    db.collection(WA_CONVERSATIONS_COLLECTION).countDocuments({
      ...match,
      matchStatus: { $in: ['matched', 'manually_linked'] },
    }),
  ]);

  return { total, unread, unmatched, ambiguous, matched };
}
