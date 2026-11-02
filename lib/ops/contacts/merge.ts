import type { ContactRole } from '@/lib/ops/contacts/types';

export type MergeConflict = {
  field: string;
  existing: string;
  incoming: string;
};

/** Keep the existing non-empty value. Fill when the stored value is blank. Never overwrite silently. */
export function mergeField(current: string, incoming: string, field: string): {
  value: string;
  changed: boolean;
  conflict?: MergeConflict;
} {
  const prev = current.trim();
  const next = incoming.trim();
  if (!next || next.toLowerCase() === prev.toLowerCase()) {
    return { value: prev, changed: false };
  }
  if (!prev) return { value: next, changed: true };
  return {
    value: prev,
    changed: false,
    conflict: { field, existing: prev, incoming: next },
  };
}

export function unionRoles(current: ContactRole[], incoming: ContactRole[]): {
  roles: ContactRole[];
  added: ContactRole[];
} {
  const seen = new Set(current);
  const added = incoming.filter((role) => !seen.has(role));
  return { roles: [...current, ...added], added };
}

export function stickyFlag(current: boolean, incoming: boolean): { value: boolean; changed: boolean } {
  if (!current && incoming) return { value: true, changed: true };
  return { value: current, changed: false };
}
