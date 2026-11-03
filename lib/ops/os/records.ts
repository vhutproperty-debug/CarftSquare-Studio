export type ActorStamp = {
  id?: string;
  email?: string;
};

export type StampedRecord = {
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export function nowIso(now = new Date()): string {
  return now.toISOString();
}

export function actorId(actor: ActorStamp | null | undefined): string {
  return String(actor?.id || actor?.email || '').trim();
}

export function stampCreate(actor: ActorStamp | null | undefined, now = new Date()): StampedRecord {
  const at = nowIso(now);
  const id = actorId(actor);
  return {
    createdBy: id,
    updatedBy: id,
    createdAt: at,
    updatedAt: at,
    deletedAt: null,
  };
}

export function stampUpdate(actor: ActorStamp | null | undefined, now = new Date()): { updatedBy: string; updatedAt: string } {
  return {
    updatedBy: actorId(actor),
    updatedAt: nowIso(now),
  };
}

/** Marks a row removed without deleting it. Callers must not issue deleteOne. */
export function softDeletePatch(actor: ActorStamp | null | undefined, now = new Date()): {
  deletedAt: string;
  updatedBy: string;
  updatedAt: string;
} {
  const at = nowIso(now);
  return {
    deletedAt: at,
    updatedBy: actorId(actor),
    updatedAt: at,
  };
}

/** Matches live rows, including documents created before soft-delete existed. */
export function notDeletedFilter(): Record<string, unknown> {
  return { $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }] };
}

export function isSoftDeleted(record: { deletedAt?: string | null } | null | undefined): boolean {
  return Boolean(record?.deletedAt);
}
