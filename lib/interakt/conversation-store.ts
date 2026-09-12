import { v4 as uuidv4 } from 'uuid';
import type { Db } from 'mongodb';
import type {
  InteraktConversation,
  InteraktLinkCandidate,
  InteraktMatchStatus,
} from '@/lib/interakt/types';

export const INTERAKT_CONVERSATIONS_COLLECTION = 'interakt_conversations';

let indexesEnsured = false;

export async function ensureInteraktConversationIndexes(db: Db): Promise<void> {
  if (indexesEnsured) return;
  const col = db.collection(INTERAKT_CONVERSATIONS_COLLECTION);
  await col.createIndex({ id: 1 }, { unique: true });
  await col.createIndex(
    { businessWaNumber: 1, normalizedPhone: 1 },
    { unique: true },
  );
  await col.createIndex(
    { businessWaNumber: 1, providerCustomerId: 1 },
    { unique: true, sparse: true },
  );
  await col.createIndex({ normalizedPhone: 1 });
  await col.createIndex({ matchStatus: 1 });
  await col.createIndex({ unreadCount: 1, lastInboundAt: -1 });
  await col.createIndex({ lastMessageAt: -1 });
  indexesEnsured = true;
}

export async function findConversationByPhone(
  db: Db,
  businessWaNumber: string,
  normalizedPhone: string,
): Promise<InteraktConversation | null> {
  await ensureInteraktConversationIndexes(db);
  return db.collection(INTERAKT_CONVERSATIONS_COLLECTION).findOne(
    { businessWaNumber, normalizedPhone },
    { projection: { _id: 0 } },
  ) as unknown as Promise<InteraktConversation | null>;
}

export async function getConversationById(
  db: Db,
  id: string,
): Promise<InteraktConversation | null> {
  await ensureInteraktConversationIndexes(db);
  return db.collection(INTERAKT_CONVERSATIONS_COLLECTION).findOne(
    { id },
    { projection: { _id: 0 } },
  ) as unknown as Promise<InteraktConversation | null>;
}

export async function upsertConversationIdentity(
  db: Db,
  input: {
    businessWaNumber: string;
    normalizedPhone: string;
    customerWaE164: string;
    providerCustomerId: string | null;
  },
): Promise<InteraktConversation> {
  await ensureInteraktConversationIndexes(db);
  const now = new Date().toISOString();
  const existing = await findConversationByPhone(
    db,
    input.businessWaNumber,
    input.normalizedPhone,
  );

  if (existing) {
    const patch: Partial<InteraktConversation> = {
      updatedAt: now,
      customerWaE164: input.customerWaE164 || existing.customerWaE164,
    };
    if (input.providerCustomerId && !existing.providerCustomerId) {
      patch.providerCustomerId = input.providerCustomerId;
    }
    await db.collection(INTERAKT_CONVERSATIONS_COLLECTION).updateOne(
      { id: existing.id },
      { $set: patch },
    );
    return { ...existing, ...patch };
  }

  const conversation: InteraktConversation = {
    id: uuidv4(),
    provider: 'interakt',
    providerCustomerId: input.providerCustomerId,
    customerWaE164: input.customerWaE164,
    normalizedPhone: input.normalizedPhone,
    businessWaNumber: input.businessWaNumber,
    matchStatus: 'unmatched',
    primaryLink: null,
    candidateLinks: [],
    lastMessageAt: null,
    lastInboundAt: null,
    lastOutboundAt: null,
    unreadCount: 0,
    createdAt: now,
    updatedAt: now,
  };

  try {
    await db.collection(INTERAKT_CONVERSATIONS_COLLECTION).insertOne(conversation);
    return conversation;
  } catch (error) {
    const code = (error as { code?: number })?.code;
    if (code === 11000) {
      const raced = await findConversationByPhone(
        db,
        input.businessWaNumber,
        input.normalizedPhone,
      );
      if (raced) return raced;
    }
    throw error;
  }
}

export async function updateConversationMatch(
  db: Db,
  conversationId: string,
  match: {
    matchStatus: InteraktMatchStatus;
    primaryLink: InteraktLinkCandidate | null;
    candidateLinks: InteraktLinkCandidate[];
  },
): Promise<void> {
  await ensureInteraktConversationIndexes(db);
  await db.collection(INTERAKT_CONVERSATIONS_COLLECTION).updateOne(
    { id: conversationId },
    {
      $set: {
        matchStatus: match.matchStatus,
        primaryLink: match.primaryLink,
        candidateLinks: match.candidateLinks,
        updatedAt: new Date().toISOString(),
      },
    },
  );
}

export async function clearConversationUnread(
  db: Db,
  conversationId: string,
): Promise<void> {
  await ensureInteraktConversationIndexes(db);
  await db.collection(INTERAKT_CONVERSATIONS_COLLECTION).updateOne(
    { id: conversationId },
    {
      $set: {
        unreadCount: 0,
        updatedAt: new Date().toISOString(),
      },
    },
  );
}

export async function setConversationManualLink(
  db: Db,
  conversationId: string,
  primaryLink: InteraktLinkCandidate,
  candidateLinks?: InteraktLinkCandidate[],
): Promise<InteraktConversation | null> {
  await ensureInteraktConversationIndexes(db);
  const existing = await getConversationById(db, conversationId);
  if (!existing) return null;

  const now = new Date().toISOString();
  const candidates = candidateLinks && candidateLinks.length
    ? candidateLinks
    : existing.candidateLinks.some((c) => c.entityId === primaryLink.entityId && c.entityType === primaryLink.entityType)
      ? existing.candidateLinks
      : [...existing.candidateLinks, primaryLink];

  await db.collection(INTERAKT_CONVERSATIONS_COLLECTION).updateOne(
    { id: conversationId },
    {
      $set: {
        matchStatus: 'manually_linked',
        primaryLink,
        candidateLinks: candidates,
        updatedAt: now,
      },
    },
  );

  return getConversationById(db, conversationId);
}

export async function touchConversationMessageMeta(
  db: Db,
  conversationId: string,
  input: {
    at: string;
    direction: 'inbound' | 'outbound';
    incrementUnread?: boolean;
  },
): Promise<void> {
  await ensureInteraktConversationIndexes(db);
  const set: Record<string, unknown> = {
    lastMessageAt: input.at,
    updatedAt: new Date().toISOString(),
  };
  if (input.direction === 'inbound') {
    set.lastInboundAt = input.at;
  } else {
    set.lastOutboundAt = input.at;
  }

  const update: Record<string, unknown> = { $set: set };
  if (input.incrementUnread) {
    update.$inc = { unreadCount: 1 };
  }

  await db.collection(INTERAKT_CONVERSATIONS_COLLECTION).updateOne(
    { id: conversationId },
    update,
  );
}
