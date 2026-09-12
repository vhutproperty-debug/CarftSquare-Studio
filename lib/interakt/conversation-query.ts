import type { Db, Filter } from 'mongodb';
import {
  INTERAKT_CONVERSATIONS_COLLECTION,
  ensureInteraktConversationIndexes,
} from '@/lib/interakt/conversation-store';
import { getInteraktBusinessWaNumber } from '@/lib/interakt/phone';
import type { InteraktConversation, InteraktMatchStatus } from '@/lib/interakt/types';

export type ConversationListFilters = {
  matchStatus?: InteraktMatchStatus;
  unreadOnly?: boolean;
  search?: string;
  limit?: number;
  businessWaNumber?: string;
};

export async function listInteraktConversations(
  db: Db,
  filters: ConversationListFilters = {},
): Promise<InteraktConversation[]> {
  await ensureInteraktConversationIndexes(db);
  const businessWaNumber = filters.businessWaNumber || getInteraktBusinessWaNumber();
  const query: Filter<InteraktConversation> = {};

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
    .collection(INTERAKT_CONVERSATIONS_COLLECTION)
    .find(query, { projection: { _id: 0 } })
    .sort({ lastMessageAt: -1, updatedAt: -1 })
    .limit(filters.limit || 200)
    .toArray() as Promise<InteraktConversation[]>;
}

export async function getInteraktConversationMetrics(db: Db, businessWaNumber?: string) {
  await ensureInteraktConversationIndexes(db);
  const wa = businessWaNumber || getInteraktBusinessWaNumber();
  const match = wa ? { businessWaNumber: wa } : {};

  const [total, unread, unmatched, ambiguous, matched] = await Promise.all([
    db.collection(INTERAKT_CONVERSATIONS_COLLECTION).countDocuments(match),
    db.collection(INTERAKT_CONVERSATIONS_COLLECTION).countDocuments({ ...match, unreadCount: { $gt: 0 } }),
    db.collection(INTERAKT_CONVERSATIONS_COLLECTION).countDocuments({ ...match, matchStatus: 'unmatched' }),
    db.collection(INTERAKT_CONVERSATIONS_COLLECTION).countDocuments({ ...match, matchStatus: 'ambiguous' }),
    db.collection(INTERAKT_CONVERSATIONS_COLLECTION).countDocuments({
      ...match,
      matchStatus: { $in: ['matched', 'manually_linked'] },
    }),
  ]);

  return { total, unread, unmatched, ambiguous, matched };
}
