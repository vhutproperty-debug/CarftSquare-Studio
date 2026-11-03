export type ContactPhoneRef = {
  id: string;
  name?: string;
  phones: string[];
};

export type DuplicateGroup = {
  phone: string;
  contactIds: string[];
};

export type DuplicateReview = {
  id: string;
  phone: string;
  contactIds: string[];
  status: 'open' | 'resolved';
  decision: '' | 'keep_both' | 'dismiss';
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
  deletedAt: string | null;
};

/** Groups contacts that share a phone. Does not choose a winner or merge rows. */
export function findDuplicateGroups(contacts: ContactPhoneRef[]): DuplicateGroup[] {
  const byPhone = new Map<string, Set<string>>();
  for (const contact of contacts) {
    for (const phone of contact.phones) {
      const key = phone.trim();
      if (!key) continue;
      const ids = byPhone.get(key) || new Set<string>();
      ids.add(contact.id);
      byPhone.set(key, ids);
    }
  }
  return [...byPhone.entries()]
    .map(([phone, ids]) => ({ phone, contactIds: [...ids].sort() }))
    .filter((group) => group.contactIds.length > 1)
    .sort((a, b) => a.phone.localeCompare(b.phone));
}

export function reviewKey(phone: string, contactIds: string[]): string {
  return `${phone}:${[...contactIds].sort().join(',')}`;
}

export type ReviewDecision = 'keep_both' | 'dismiss';

export function applyReviewDecision(review: DuplicateReview, decision: ReviewDecision, actorId: string, now = new Date()): DuplicateReview {
  if (decision !== 'keep_both' && decision !== 'dismiss') {
    throw new Error('Choose keep both or dismiss. Contacts are never merged.');
  }
  return {
    ...review,
    status: 'resolved',
    decision,
    updatedAt: now.toISOString(),
    updatedBy: actorId,
  };
}
