/**
 * Higher scores sort first.
 * Each extra group outweighs the admin boost, so a broker in more groups
 * stays ahead of a one-group admin. Admins still rank above the same group count.
 * A one-group admin still outranks a one-group broker who is not an admin.
 */
export function brokerPriorityScore(groupCount: number, admin: boolean): number {
  const groups = Number.isFinite(groupCount) ? Math.max(0, Math.trunc(groupCount)) : 0;
  return groups * 100 + (admin ? 40 : 0);
}

export function isPriorityBroker(groupCount: number, admin: boolean): boolean {
  return Boolean(admin) || groupCount > 1;
}
